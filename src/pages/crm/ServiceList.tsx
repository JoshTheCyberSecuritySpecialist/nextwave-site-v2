import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { bookingError, formatDuration, listServices, type BookingService } from '../../lib/crm-booking';

export default function ServiceList() {
  const workspace = useOutletContext<CrmSelection>();
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    listServices(workspace.organizationId)
      .then(rows => { if (!stopped) setServices(rows); })
      .catch(reason => { if (!stopped) setError(bookingError(reason, 'Services could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          {!loading && !error && (
            <p className="mt-2 text-gray-300">
              {services.length} {services.length === 1 ? 'service' : 'services'} in this workspace.
              {workspace.maxServices != null ? ` The limit is ${workspace.maxServices}.` : ''}
            </p>
          )}
        </div>
        <Link to="/crm/services/new" className="inline-flex min-h-11 items-center rounded-lg bg-[#2283B8] px-4 font-semibold">Add service</Link>
      </div>
      {loading && <div className="mt-6 h-40 animate-pulse rounded-xl bg-[#0d1424]" />}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {!loading && !error && services.length === 0 && <p className="mt-6 text-gray-300">No services have been added.</p>}
      {!loading && !error && services.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#0d1424] text-gray-300">
              <tr>{['Service', 'Duration', 'Booking page'].map(heading => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr key={service.id} className="border-t border-gray-800">
                  <td className="px-4 py-3">
                    <Link className="text-[#7dd3f5] underline" to={`/crm/services/${service.id}/edit`}>{service.name}</Link>
                    {service.description && <p className="mt-1 max-w-xl text-gray-400">{service.description}</p>}
                  </td>
                  <td className="px-4 py-3">{formatDuration(service.duration_minutes)}</td>
                  <td className="px-4 py-3">{service.active ? 'Shown' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
