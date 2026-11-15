import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { bookingError, createService, deleteService, getService, updateService, type ServiceInput } from '../../lib/crm-booking';

const empty: ServiceInput = { name: '', description: '', durationMinutes: 30, active: true };
const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 text-white';

export default function ServiceEditor() {
  const workspace = useOutletContext<CrmSelection>();
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(serviceId);
  const [input, setInput] = useState<ServiceInput>(empty);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!serviceId) return;
    let stopped = false;
    setLoading(true);
    getService(workspace.organizationId, serviceId)
      .then(service => {
        if (stopped) return;
        if (!service) {
          setError('This service is not in the selected workspace.');
          return;
        }
        setInput({
          name: service.name,
          description: service.description ?? '',
          durationMinutes: service.duration_minutes,
          active: service.active,
        });
      })
      .catch(reason => { if (!stopped) setError(bookingError(reason, 'The service could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [serviceId, workspace.organizationId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (serviceId) await updateService(workspace.organizationId, serviceId, input);
      else await createService(workspace.organizationId, input);
      navigate('/crm/services');
    } catch (reason) {
      setError(bookingError(reason, 'The service could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!serviceId) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await deleteService(workspace.organizationId, serviceId);
      navigate('/crm/services');
    } catch (reason) {
      setError(bookingError(reason, 'The service could not be removed.'));
      setSaving(false);
    }
  }

  return (
    <section className="max-w-2xl">
      <Link to="/crm/services" className="text-sm text-[#7dd3f5] underline">Back to services</Link>
      <h1 className="mt-4 text-3xl font-bold">{editing ? 'Edit service' : 'Add service'}</h1>
      {loading && <div className="mt-6 h-64 animate-pulse rounded-xl bg-[#0d1424]" />}
      {!loading && (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error && <p role="alert" className="text-red-200">{error}</p>}
          <label className="block text-sm text-gray-300">Name
            <input required maxLength={120} value={input.name} onChange={event => setInput(current => ({ ...current, name: event.target.value }))} className={fieldClass} />
          </label>
          <label className="block text-sm text-gray-300">Description
            <textarea maxLength={1000} rows={4} value={input.description} onChange={event => setInput(current => ({ ...current, description: event.target.value }))} className={fieldClass} />
          </label>
          <label className="block text-sm text-gray-300">Duration in minutes
            <input required type="number" min={5} max={480} step={5} value={input.durationMinutes} onChange={event => setInput(current => ({ ...current, durationMinutes: Number(event.target.value) }))} className={fieldClass} />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-gray-300">
            <input type="checkbox" checked={input.active} onChange={event => setInput(current => ({ ...current, active: event.target.checked }))} className="h-4 w-4" />
            Show this service on the booking page
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save service'}</button>
            {editing && (
              <button type="button" disabled={saving} onClick={() => { void onDelete(); }} className="min-h-11 rounded-lg border border-gray-700 px-4 disabled:opacity-50">
                {confirmingDelete ? 'Confirm removal' : 'Remove service'}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
