import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { customerError, listCustomers, pageSize, type CustomerSummary } from '../../lib/crm-customers';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

export default function CustomerDirectory() {
  const workspace = useOutletContext<CrmSelection>();
  const [params, setParams] = useSearchParams();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = params.get('q') ?? '';
  const status = params.get('status') ?? 'active';
  const stage = params.get('stage') ?? '';
  const page = Number(params.get('page') ?? '0') || 0;

  useEffect(() => {
    if (!workspace.crmEnabled) return;
    let stopped = false;
    setLoading(true);
    setError('');
    listCustomers(workspace.organizationId, { search, status, stage, page })
      .then(result => {
        if (stopped) return;
        setCustomers(result.customers);
        setCount(result.count);
      })
      .catch(reason => { if (!stopped) setError(customerError(reason, 'Customers could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.crmEnabled, workspace.organizationId, search, status, stage, page]);

  if (!workspace.crmEnabled) return <Navigate to="/crm" replace />;

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const q = String(data.get('q') ?? '').trim();
    const nextStatus = String(data.get('status') ?? 'active');
    const nextStage = String(data.get('stage') ?? '');
    if (q) next.set('q', q);
    if (nextStatus) next.set('status', nextStatus);
    if (nextStage) next.set('stage', nextStage);
    setParams(next);
  }

  const pages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          {!loading && !error && <p className="mt-2 text-gray-300">{count} records in this workspace. The limit is {workspace.maxCustomers}.</p>}
        </div>
        <Link to="/crm/customers/new" className="inline-flex min-h-11 items-center rounded-lg bg-[#2283B8] px-4 font-semibold">Add customer</Link>
      </div>
      <form className="mt-6 grid gap-3 md:grid-cols-[1fr_10rem_10rem_auto]" onSubmit={onFilter}>
        <div>
          <label htmlFor="customer-search" className="sr-only">Search customers</label>
          <input id="customer-search" name="q" defaultValue={search} placeholder="Search name, email, or phone" className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3" />
        </div>
        <select name="status" defaultValue={status} aria-label="Status" className="min-h-11 rounded-lg border border-gray-700 bg-[#0d1424] px-3">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="">Any status</option>
        </select>
        <select name="stage" defaultValue={stage} aria-label="Lead stage" className="min-h-11 rounded-lg border border-gray-700 bg-[#0d1424] px-3">
          <option value="">Any stage</option>
          <option value="inquiry">Inquiry</option>
          <option value="booked">Booked</option>
          <option value="completed">Completed</option>
        </select>
        <button className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold">Apply</button>
      </form>
      {loading && <div className="mt-6 h-40 animate-pulse rounded-xl bg-[#0d1424]" />}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {!loading && !error && customers.length === 0 && <p className="mt-6 text-gray-300">No customers match this view.</p>}
      {!loading && !error && customers.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#0d1424] text-gray-300">
              <tr>{['Name', 'Contact', 'Status', 'Stage', 'Tags', 'Updated'].map(heading => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id} className="border-t border-gray-800">
                  <td className="px-4 py-3"><Link className="text-[#7dd3f5] underline" to={`/crm/customers/${customer.id}`}>{customer.display_name}</Link></td>
                  <td className="px-4 py-3">{customer.email || customer.phone || '—'}</td>
                  <td className="px-4 py-3 capitalize">{customer.status}</td>
                  <td className="px-4 py-3 capitalize">{customer.lead_stage}</td>
                  <td className="px-4 py-3">{customer.tags.length ? customer.tags.join(', ') : '—'}</td>
                  <td className="px-4 py-3">{when(customer.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="min-h-11 rounded-lg border border-gray-700 px-4 disabled:opacity-40" disabled={page <= 0} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page - 1)); return next; })}>Previous</button>
          <p className="text-sm text-gray-300">Page {page + 1} of {pages}</p>
          <button type="button" className="min-h-11 rounded-lg border border-gray-700 px-4 disabled:opacity-40" disabled={page + 1 >= pages} onClick={() => setParams(current => { const next = new URLSearchParams(current); next.set('page', String(page + 1)); return next; })}>Next</button>
        </div>
      )}
    </section>
  );
}
