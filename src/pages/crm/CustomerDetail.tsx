import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { addNote, customerError, getCustomer, listCustomerActivity, listNotes, type CustomerActivity, type CustomerNote, type CustomerSummary } from '../../lib/crm-customers';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function CustomerDetail() {
  const workspace = useOutletContext<CrmSelection>();
  const { customerId = '' } = useParams();
  const [customer, setCustomer] = useState<(CustomerSummary & { created_at: string }) | null>(null);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [activity, setActivity] = useState<CustomerActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteError, setNoteError] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!workspace.crmEnabled || !customerId) return;
    let stopped = false;
    setLoading(true);
    setError('');
    Promise.all([
      getCustomer(workspace.organizationId, customerId),
      listNotes(workspace.organizationId, customerId),
      listCustomerActivity(workspace.organizationId, customerId),
    ]).then(([nextCustomer, nextNotes, nextActivity]) => {
      if (stopped) return;
      setCustomer(nextCustomer);
      setNotes(nextNotes);
      setActivity(nextActivity);
      if (!nextCustomer) setError('This customer is not in the selected workspace.');
    }).catch(reason => {
      if (!stopped) setError(customerError(reason, 'The customer could not be loaded.'));
    }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.crmEnabled, workspace.organizationId, customerId, revision]);

  if (!workspace.crmEnabled) return <Navigate to="/crm" replace />;

  async function onNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body') ?? '');
    setSavingNote(true);
    setNoteError('');
    try {
      await addNote(workspace.organizationId, customerId, body);
      event.currentTarget.reset();
      setRevision(value => value + 1);
    } catch (reason) {
      setNoteError(customerError(reason, 'The note could not be saved.'));
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <section className="max-w-3xl">
      <Link to="/crm/customers" className="text-sm text-[#7dd3f5] underline">Back to customers</Link>
      {loading && <div className="mt-6 h-48 animate-pulse rounded-xl bg-[#0d1424]" />}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {customer && (
        <>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{customer.display_name}</h1>
              <p className="mt-2 capitalize text-gray-300">{customer.status} · {customer.lead_stage}</p>
            </div>
            <Link to={`/crm/customers/${customer.id}/edit`} className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-4">Edit customer</Link>
          </div>
          <dl className="mt-6 grid gap-4 rounded-xl border border-gray-800 bg-[#0d1424] p-5 sm:grid-cols-2">
            <div><dt className="text-sm text-gray-400">Email</dt><dd>{customer.email || '—'}</dd></div>
            <div><dt className="text-sm text-gray-400">Phone</dt><dd>{customer.phone || '—'}</dd></div>
            <div><dt className="text-sm text-gray-400">Tags</dt><dd>{customer.tags.length ? customer.tags.join(', ') : '—'}</dd></div>
            <div><dt className="text-sm text-gray-400">Updated</dt><dd>{when(customer.updated_at)}</dd></div>
          </dl>
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Notes</h2>
            <form className="mt-3 space-y-3" onSubmit={onNote}>
              <label htmlFor="customer-note" className="block text-sm text-gray-300">Add an internal note</label>
              <textarea id="customer-note" name="body" required maxLength={4000} rows={4} className="w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 py-2" />
              {noteError && <p role="alert" className="text-red-200">{noteError}</p>}
              <button type="submit" disabled={savingNote} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{savingNote ? 'Saving…' : 'Save note'}</button>
            </form>
            {notes.length === 0 ? <p className="mt-4 text-gray-300">No notes yet.</p> : (
              <ul className="mt-4 space-y-3">
                {notes.map(note => (
                  <li key={note.id} className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
                    <p className="whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-2 text-sm text-gray-400">{when(note.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Activity</h2>
            {activity.length === 0 ? <p className="mt-3 text-gray-300">No activity has been recorded.</p> : (
              <ol className="mt-4 space-y-3">
                {activity.map(item => (
                  <li key={item.id} className="rounded-xl border border-gray-800 px-4 py-3">
                    <p>{item.summary}</p>
                    <p className="mt-1 text-sm text-gray-400">{when(item.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </section>
  );
}
