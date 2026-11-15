import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { createCustomer, customerError, getCustomer, updateCustomer, type CustomerInput, type CustomerStatus, type LeadStage } from '../../lib/crm-customers';

const empty: CustomerInput = { displayName: '', email: '', phone: '', status: 'active', leadStage: 'inquiry', tags: '' };

export default function CustomerEditor() {
  const workspace = useOutletContext<CrmSelection>();
  const { customerId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(customerId);
  const [input, setInput] = useState<CustomerInput>(empty);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId || !workspace.crmEnabled) return;
    let stopped = false;
    setLoading(true);
    getCustomer(workspace.organizationId, customerId)
      .then(customer => {
        if (stopped) return;
        if (!customer) {
          setError('This customer is not in the selected workspace.');
          return;
        }
        setInput({
          displayName: customer.display_name,
          email: customer.email ?? '',
          phone: customer.phone ?? '',
          status: customer.status,
          leadStage: customer.lead_stage,
          tags: customer.tags.join(', '),
        });
      })
      .catch(reason => { if (!stopped) setError(customerError(reason, 'The customer could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [customerId, workspace.crmEnabled, workspace.organizationId]);

  if (!workspace.crmEnabled) return <Navigate to="/crm" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (customerId) {
        await updateCustomer(workspace.organizationId, customerId, input);
        navigate(`/crm/customers/${customerId}`);
      } else {
        const id = await createCustomer(workspace.organizationId, input);
        navigate(`/crm/customers/${id}`);
      }
    } catch (reason) {
      setError(customerError(reason, 'The customer could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  function setField<Key extends keyof CustomerInput>(key: Key, value: CustomerInput[Key]) {
    setInput(current => ({ ...current, [key]: value }));
  }

  return (
    <section className="max-w-2xl">
      <Link to={customerId ? `/crm/customers/${customerId}` : '/crm/customers'} className="text-sm text-[#7dd3f5] underline">Back</Link>
      <h1 className="mt-4 text-3xl font-bold">{editing ? 'Edit customer' : 'Add customer'}</h1>
      {loading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-[#0d1424]" />}
      {!loading && (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error && <p role="alert" className="text-red-200">{error}</p>}
          <label className="block text-sm text-gray-300">Name
            <input required maxLength={200} value={input.displayName} onChange={event => setField('displayName', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white" />
          </label>
          <label className="block text-sm text-gray-300">Email
            <input type="email" maxLength={320} value={input.email} onChange={event => setField('email', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white" />
          </label>
          <label className="block text-sm text-gray-300">Phone
            <input maxLength={40} value={input.phone} onChange={event => setField('phone', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-300">Status
              <select value={input.status} onChange={event => setField('status', event.target.value as CustomerStatus)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="block text-sm text-gray-300">Lead stage
              <select value={input.leadStage} onChange={event => setField('leadStage', event.target.value as LeadStage)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3">
                <option value="inquiry">Inquiry</option>
                <option value="booked">Booked</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
          <label className="block text-sm text-gray-300">Tags
            <input value={input.tags} onChange={event => setField('tags', event.target.value)} placeholder="vip, weekday" className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white" />
          </label>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save customer'}</button>
        </form>
      )}
    </section>
  );
}
