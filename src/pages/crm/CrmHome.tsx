import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { businessWebsitePackage, legacyBookingPackage, websiteCrmPackage } from '../../data/offers';
import { customerCounts, customerError, recentActivity, type CustomerActivity } from '../../lib/crm-customers';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function CrmHome() {
  const workspace = useOutletContext<CrmSelection>();
  const [counts, setCounts] = useState<{ active: number; archived: number } | null>(null);
  const [activity, setActivity] = useState<CustomerActivity[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(workspace.crmEnabled);

  useEffect(() => {
    if (!workspace.crmEnabled) return;
    let stopped = false;
    setLoading(true);
    setError('');
    Promise.all([customerCounts(workspace.organizationId), recentActivity(workspace.organizationId)])
      .then(([nextCounts, nextActivity]) => {
        if (stopped) return;
        setCounts(nextCounts);
        setActivity(nextActivity);
      })
      .catch(reason => {
        if (!stopped) setError(customerError(reason, 'Workspace totals could not be loaded.'));
      })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.crmEnabled, workspace.organizationId]);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="mt-2 max-w-2xl text-gray-300">{
            workspace.crmEnabled
              ? websiteCrmPackage.limits
              : workspace.websiteEnabled
                ? businessWebsitePackage.scopeNote
                : legacyBookingPackage.scopeNote
          }</p>
        </div>
        {workspace.crmEnabled && <Link to="/crm/customers/new" className="inline-flex min-h-11 items-center rounded-lg bg-[#2283B8] px-4 font-semibold">Add customer</Link>}
      </div>
      {!workspace.crmEnabled && (
        <p className="mt-6 rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">
          {workspace.websiteEnabled
            ? 'This website workspace does not include the customer directory, notes, or customer activity.'
            : 'This booking workspace does not include the customer directory, notes, or customer activity.'}
        </p>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Booking setup</h2>
        <p className="mt-2 max-w-2xl text-gray-300">Save the business profile, services, and weekly hours. The booking page shows only those saved details.</p>
        <ul className="mt-4 flex flex-wrap gap-3">
          <li><Link to="/crm/profile" className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-4">Business profile</Link></li>
          <li><Link to="/crm/services" className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-4">Services</Link></li>
          <li><Link to="/crm/hours" className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-4">Weekly hours</Link></li>
          <li><Link to="/crm/booking" className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-4">Booking page</Link></li>
          <li><Link to="/crm/appointments" className="inline-flex min-h-11 items-center rounded-lg border border-gray-700 px-4">Appointments</Link></li>
        </ul>
      </section>
      {workspace.crmEnabled && loading && <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-xl bg-[#0d1424]" /><div className="h-28 animate-pulse rounded-xl bg-[#0d1424]" /></div>}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {workspace.crmEnabled && counts && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Active customers</p>
            <p className="mt-2 text-3xl font-bold">{counts.active}</p>
          </article>
          <article className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Archived customers</p>
            <p className="mt-2 text-3xl font-bold">{counts.archived}</p>
          </article>
        </div>
      )}
      {workspace.crmEnabled && !loading && !error && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Recent customer activity</h2>
          {activity.length === 0 ? <p className="mt-3 text-gray-300">No customer activity has been recorded.</p> : (
            <ol className="mt-4 space-y-3">
              {activity.map(item => (
                <li key={item.id} className="rounded-xl border border-gray-800 bg-[#0d1424] px-4 py-3">
                  <p className="font-medium">{item.summary}</p>
                  <p className="mt-1 text-sm text-gray-400">{when(item.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </section>
  );
}
