import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bookingPackage, websiteCrmPackage } from '../data/offers';
import { apiUrl } from '../lib/payments-client.mjs';

const ADMIN_EMAIL = 'joshua@nextwavedigitalsolution.com';
const apiEnv = { dev: import.meta.env.DEV, configured: import.meta.env.VITE_API_BASE_URL };

type AdminOrder = {
  id: string;
  email: string;
  packageId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  intakeComplete: boolean;
  businessName: string | null;
  requirements?: string | null;
  intakeSubmittedAt: string | null;
  projectId: string | null;
  projectStatus: string | null;
  customerReference: string | null;
};

const paidStatuses = new Set(['paid', 'intake_received', 'fulfilled']);

const nav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/intakes', label: 'Customer Intakes' },
  { to: '/blog-admin', label: 'Blog Management' },
  { to: '/admin/settings', label: 'Settings' },
];

function packageName(id: string) {
  if (id === bookingPackage.id) return bookingPackage.name;
  if (id === websiteCrmPackage.id) return websiteCrmPackage.name;
  return id;
}

function money(cents: number, currency: string) {
  if (!Number.isInteger(cents) || currency !== 'usd') return 'Unavailable';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function when(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

async function loadOrders(token: string, id?: string): Promise<AdminOrder[] | AdminOrder> {
  const path = id ? `/api/admin/orders/${id}` : '/api/admin/orders';
  let response: Response;
  try {
    response = await fetch(apiUrl(path, apiEnv), { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  } catch {
    throw Error('Orders could not be loaded.');
  }
  const body = await response.json().catch(() => null) as { error?: string; orders?: AdminOrder[]; order?: AdminOrder } | null;
  if (response.status === 401) throw Error('You are not authorized to view orders.');
  if (!response.ok || !body) throw Error(body?.error || 'Orders could not be loaded.');
  if (id) {
    if (!body.order) throw Error('Order not found.');
    return body.order;
  }
  if (!Array.isArray(body.orders)) throw Error('Orders could not be loaded.');
  return body.orders;
}

function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#0d1424] px-4">
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-lg border border-gray-700 px-3 py-2 text-sm lg:hidden" aria-expanded={open} onClick={() => setOpen(value => !value)}>Menu</button>
          <img src="/nextwave_smoothblue.png" alt="NextWave" className="h-8" />
          <span className="font-semibold">Admin</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <span className="hidden sm:inline">{user?.email}</span>
          <button type="button" className="rounded-lg px-3 py-2 hover:bg-[#0A0F1E]" onClick={() => { void signOut().then(() => navigate('/login')); }}>Sign out</button>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        <nav className={`${open ? 'block' : 'hidden'} border-b border-gray-800 bg-[#0d1424] p-4 lg:block lg:border-b-0 lg:border-r`}>
          <ul className="space-y-1">
            {nav.map(item => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-[#2283B8] text-white' : 'text-gray-300 hover:bg-[#0A0F1E]'}`}>{item.label}</NavLink>
              </li>
            ))}
            <li><Link to="/" className="block rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-[#0A0F1E]">View website</Link></li>
          </ul>
        </nav>
        <main className="px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function Metrics({ orders }: { orders: AdminOrder[] }) {
  const counts = {
    total: orders.length,
    paid: orders.filter(order => paidStatuses.has(order.status)).length,
    awaiting: orders.filter(order => order.status === 'paid' && !order.intakeComplete).length,
    intakes: orders.filter(order => order.intakeComplete).length,
  };
  const cards = [
    ['Total orders', counts.total],
    ['Paid orders', counts.paid],
    ['Awaiting intake', counts.awaiting],
    ['Completed intakes', counts.intakes],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <article key={label} className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </article>
      ))}
    </div>
  );
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <p className="mt-6 text-gray-300">No orders match this view.</p>;
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-gray-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#0d1424] text-gray-300">
          <tr>
            {['Email', 'Package', 'Date', 'Amount', 'Payment', 'Intake'].map(heading => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id} className="border-t border-gray-800">
              <td className="px-4 py-3"><Link className="text-[#7dd3f5] underline" to={`/admin/orders/${order.id}`}>{order.email}</Link></td>
              <td className="px-4 py-3">{packageName(order.packageId)}</td>
              <td className="px-4 py-3">{when(order.createdAt)}</td>
              <td className="px-4 py-3">{money(order.amount, order.currency)}</td>
              <td className="px-4 py-3 capitalize">{statusLabel(order.status)}</td>
              <td className="px-4 py-3">{order.intakeComplete ? 'Complete' : 'Not submitted'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const location = useLocation();
  const { session, user } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [workspace, setWorkspace] = useState<{ organizationId: string; duplicate: boolean; invitationToken: string | null; packageId: string | null; status: string } | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const detailId = location.pathname.match(/^\/admin\/orders\/([0-9a-f-]{36})$/i)?.[1] ?? '';
  const view = detailId ? 'detail' : location.pathname === '/admin/orders' ? 'orders' : location.pathname === '/admin/intakes' ? 'intakes' : location.pathname === '/admin/settings' ? 'settings' : 'overview';
  const allowed = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!allowed || !session?.access_token || view === 'settings') {
      setLoading(false);
      return;
    }
    let stopped = false;
    setLoading(true);
    setError('');
    const run = async () => {
      try {
        if (view === 'detail') {
          const order = await loadOrders(session.access_token, detailId) as AdminOrder;
          if (!stopped) setDetail(order);
        } else {
          const list = await loadOrders(session.access_token) as AdminOrder[];
          if (!stopped) setOrders(list);
        }
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : 'Orders could not be loaded.');
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    void run();
    return () => { stopped = true; };
  }, [allowed, session?.access_token, view, detailId]);

  useEffect(() => {
    setWorkspace(null);
    setWorkspaceError('');
  }, [detailId]);

  async function postWorkspace(path: string, body: Record<string, string>) {
    if (!session?.access_token) return;
    setWorkspaceBusy(true);
    setWorkspaceError('');
    try {
      const response = await fetch(apiUrl(path, apiEnv), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { error?: string; organizationId?: string; duplicate?: boolean; invitationToken?: string | null; packageId?: string | null; status?: string } | null;
      if (!response.ok || !payload?.organizationId || !/^[0-9a-f-]{36}$/i.test(payload.organizationId)) {
        throw Error(payload?.error || 'The workspace could not be updated.');
      }
      const invitationToken = typeof payload.invitationToken === 'string' && /^[a-f0-9]{64}$/.test(payload.invitationToken) ? payload.invitationToken : null;
      setWorkspace({
        organizationId: payload.organizationId,
        duplicate: payload.duplicate === true,
        invitationToken,
        packageId: typeof payload.packageId === 'string' ? payload.packageId : null,
        status: typeof payload.status === 'string' ? payload.status : '',
      });
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : 'The workspace could not be updated.');
    } finally {
      setWorkspaceBusy(false);
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter(order => {
      const matchesQuery = !needle || order.email.toLowerCase().includes(needle) || packageName(order.packageId).toLowerCase().includes(needle) || (order.businessName ?? '').toLowerCase().includes(needle);
      const matchesFilter = filter === 'all'
        || (filter === 'paid' && paidStatuses.has(order.status))
        || (filter === 'awaiting' && order.status === 'paid' && !order.intakeComplete)
        || (filter === 'intake' && order.intakeComplete);
      return matchesQuery && matchesFilter;
    });
  }, [orders, query, filter]);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setQuery(String(data.get('q') ?? ''));
    setFilter(String(data.get('filter') ?? 'all'));
  }

  return (
    <Shell>
      {!allowed && <p className="text-gray-200">This account cannot view the admin records.</p>}
      {allowed && view === 'settings' && (
        <section className="max-w-2xl">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-4 text-gray-300">Signed in as {user?.email}. Order records on this page are read-only. Blog posts are managed from Blog Management.</p>
        </section>
      )}
      {allowed && view !== 'settings' && loading && <p className="text-gray-300">Loading orders…</p>}
      {allowed && view !== 'settings' && error && <p role="alert" className="text-red-200">{error}</p>}
      {allowed && !loading && !error && view === 'overview' && (
        <section>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="mt-3 max-w-2xl text-gray-300">Counts come from stored orders. An empty database stays at zero.</p>
          <div className="mt-6"><Metrics orders={orders} /></div>
          {orders.length === 0 && <p className="mt-6 text-gray-300">No orders have been stored yet.</p>}
        </section>
      )}
      {allowed && !loading && !error && view === 'orders' && (
        <section>
          <h1 className="text-3xl font-bold">Orders</h1>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={onSearch}>
            <input name="q" defaultValue={query} placeholder="Search email, package, or business" className="min-h-11 flex-1 rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" />
            <select name="filter" defaultValue={filter} className="min-h-11 rounded-lg border border-gray-700 bg-[#0A0F1E] px-3">
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="awaiting">Awaiting intake</option>
              <option value="intake">Intake complete</option>
            </select>
            <button className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold">Apply</button>
          </form>
          <OrdersTable orders={visible} />
        </section>
      )}
      {allowed && !loading && !error && view === 'intakes' && (
        <section>
          <h1 className="text-3xl font-bold">Customer intakes</h1>
          <h2 className="mt-8 text-xl font-semibold">Completed</h2>
          <OrdersTable orders={orders.filter(order => order.intakeComplete)} />
          <h2 className="mt-8 text-xl font-semibold">Awaiting intake</h2>
          <OrdersTable orders={orders.filter(order => order.status === 'paid' && !order.intakeComplete)} />
        </section>
      )}
      {allowed && !loading && !error && view === 'detail' && detail && (
        <section className="max-w-3xl">
          <Link to="/admin/orders" className="text-sm text-[#7dd3f5] underline">Back to orders</Link>
          <h1 className="mt-4 text-3xl font-bold">{detail.email}</h1>
          <dl className="mt-6 space-y-4 text-gray-200">
            <div><dt className="text-sm text-gray-400">Package</dt><dd>{packageName(detail.packageId)}</dd></div>
            <div><dt className="text-sm text-gray-400">Order date</dt><dd>{when(detail.createdAt)}</dd></div>
            <div><dt className="text-sm text-gray-400">Amount</dt><dd>{money(detail.amount, detail.currency)}</dd></div>
            <div><dt className="text-sm text-gray-400">Payment status</dt><dd className="capitalize">{statusLabel(detail.status)}</dd></div>
            <div><dt className="text-sm text-gray-400">Business name</dt><dd>{detail.businessName || 'Not submitted'}</dd></div>
            <div><dt className="text-sm text-gray-400">Requirements</dt><dd className="whitespace-pre-wrap">{detail.requirements || 'Not submitted'}</dd></div>
            <div><dt className="text-sm text-gray-400">Intake submitted</dt><dd>{when(detail.intakeSubmittedAt)}</dd></div>
            <div><dt className="text-sm text-gray-400">Project</dt><dd>{detail.projectId ? `${detail.projectId} · ${detail.projectStatus || 'status unavailable'}` : 'No project stored for this order'}</dd></div>
            <div><dt className="text-sm text-gray-400">Customer reference</dt><dd>{detail.customerReference || 'No external customer reference stored'}</dd></div>
          </dl>
          <section className="mt-8 rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <h2 className="text-xl font-semibold">Workspace</h2>
            {paidStatuses.has(detail.status) ? (
              <>
                <p className="mt-2 text-gray-300">Provisioning uses this stored order. It does not start a new checkout and it does not email the customer.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" disabled={workspaceBusy} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50" onClick={() => { void postWorkspace('/api/admin/organizations', { orderId: detail.id }); }}>Provision workspace</button>
                  {workspace && <button type="button" disabled={workspaceBusy} className="min-h-11 rounded-lg border border-gray-700 px-4 disabled:opacity-50" onClick={() => { void postWorkspace(`/api/admin/organizations/${workspace.organizationId}/invitation`, {}); }}>Replace invitation</button>}
                  {workspace && <button type="button" disabled={workspaceBusy} className="min-h-11 rounded-lg border border-gray-700 px-4 disabled:opacity-50" onClick={() => { void postWorkspace(`/api/admin/organizations/${workspace.organizationId}/status`, { status: workspace.status === 'suspended' ? 'active' : 'suspended' }); }}>{workspace.status === 'suspended' ? 'Restore access' : 'Suspend access'}</button>}
                </div>
              </>
            ) : <p className="mt-2 text-gray-300">This order is not paid, so it cannot be provisioned.</p>}
            {workspaceError && <p role="alert" className="mt-4 text-red-200">{workspaceError}</p>}
            {workspace && <p className="mt-4 text-gray-200">{workspace.duplicate ? 'This order already has a workspace.' : 'Workspace saved.'} Reference {workspace.organizationId}.</p>}
            {workspace?.invitationToken && (
              <div className="mt-4">
                <label htmlFor="invitation-code" className="block text-sm text-gray-300">Invitation code</label>
                <input id="invitation-code" readOnly value={workspace.invitationToken} className="mt-2 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 font-mono text-sm" />
                <p className="mt-2 text-sm text-gray-400">Copy this code now. It is not stored in the browser and will not be shown again. No email is sent.</p>
              </div>
            )}
          </section>
        </section>
      )}
    </Shell>
  );
}
