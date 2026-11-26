import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { appointmentError, cancelAppointment, formatBookingTime, listAppointments, type WorkspaceAppointment } from '../../lib/public-booking';

export default function Appointments() {
  const workspace = useOutletContext<CrmSelection>();
  const [appointments, setAppointments] = useState<WorkspaceAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    listAppointments(workspace.organizationId)
      .then(rows => { if (!stopped) setAppointments(rows); })
      .catch(reason => { if (!stopped) setError(appointmentError(reason, 'Appointments could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId]);

  async function onCancel(appointmentId: string) {
    if (confirmId !== appointmentId) {
      setConfirmId(appointmentId);
      return;
    }
    setSavingId(appointmentId);
    setError('');
    try {
      await cancelAppointment(workspace.organizationId, appointmentId);
      setAppointments(current => current.map(item => item.id === appointmentId ? { ...item, status: 'cancelled' } : item));
      setConfirmId('');
    } catch (reason) {
      setError(appointmentError(reason, 'The appointment could not be cancelled.'));
    } finally {
      setSavingId('');
    }
  }

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold">Appointments</h1>
      <p className="mt-2 text-gray-300">Bookings made on the public page for this workspace, from the past 90 days through upcoming times. Nothing is listed until a guest books.</p>
      {loading && <div className="mt-6 h-40 animate-pulse rounded-xl bg-[#0d1424]" />}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {!loading && !error && appointments.length === 0 && <p className="mt-6 text-gray-300">No appointments yet.</p>}
      {!loading && !error && appointments.length > 0 && (
        <ul className="mt-6 space-y-3">
          {appointments.map(appointment => (
            <li key={appointment.id} className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{appointment.service_name}</p>
                  <p className="mt-1 text-sm text-gray-300">{formatBookingTime(appointment.starts_at, appointment.timezone, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  <p className="mt-2 text-sm text-gray-200">{appointment.guest_name}</p>
                  <p className="text-sm text-gray-400">{appointment.guest_email}</p>
                  <p className="text-sm text-gray-400">{appointment.guest_phone}</p>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm capitalize text-gray-300">{appointment.status}</p>
                  {appointment.status === 'confirmed' && (
                    <button type="button" disabled={savingId === appointment.id} onClick={() => { void onCancel(appointment.id); }} className="min-h-11 rounded-lg border border-gray-700 px-4 disabled:opacity-50">
                      {confirmId === appointment.id ? 'Confirm cancellation' : 'Cancel appointment'}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
