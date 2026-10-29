const ADMIN_EMAIL = 'joshua@nextwavedigitalsolution.com';
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function originOf(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw Error('Invalid Supabase URL'); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('Invalid Supabase URL');
  return parsed.origin;
}

function cleanText(value, max) {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function orderRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (!ORDER_ID.test(row.id ?? '') || !cleanText(row.email, 254) || !cleanText(row.package_id, 40)) return null;
  if (!Number.isInteger(row.amount) || row.amount < 0 || row.amount > 100000000) return null;
  if (!cleanText(row.currency, 8) || !cleanText(row.status, 40) || !cleanText(row.created_at, 40)) return null;
  return {
    id: row.id,
    email: row.email,
    packageId: row.package_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function createAdminOrders({ url, serviceKey, fetchImpl = fetch, adminEmail = ADMIN_EMAIL }) {
  const origin = originOf(url);
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw Error('Supabase service key required');
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' };

  async function rest(table, params) {
    const endpoint = new URL(`/rest/v1/${table}`, origin);
    for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
    const response = await fetchImpl(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers });
    if (!response.ok) throw Error('Database operation failed');
    const body = await response.json();
    if (!Array.isArray(body)) throw Error('Invalid database result');
    return body;
  }

  async function caller(jwt) {
    if (typeof jwt !== 'string' || jwt.length > 4096 || !JWT.test(jwt) || jwt === serviceKey) throw Error('Unauthorized');
    const response = await fetchImpl(new URL('/auth/v1/user', origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: serviceKey, Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
    });
    if (!response.ok) throw Error('Unauthorized');
    const user = await response.json();
    if (!user || typeof user.email !== 'string' || user.email.toLowerCase() !== adminEmail) throw Error('Unauthorized');
    return user.email.toLowerCase();
  }

  function attach(orders, intakes, projects, contacts) {
    const intakeByOrder = new Map(intakes.filter(row => ORDER_ID.test(row?.order_id ?? '')).map(row => [row.order_id, row]));
    const projectByOrder = new Map(projects.filter(row => ORDER_ID.test(row?.order_id ?? '')).map(row => [row.order_id, row]));
    const contactById = new Map(contacts.filter(row => ORDER_ID.test(row?.id ?? '')).map(row => [row.id, row]));
    return orders.map(order => {
      const intake = intakeByOrder.get(order.id);
      const project = projectByOrder.get(order.id);
      const contact = project ? contactById.get(project.contact_id) : undefined;
      return {
        ...order,
        intakeComplete: Boolean(intake && cleanText(intake.business_name, 200)),
        businessName: intake ? cleanText(intake.business_name, 200) : null,
        requirements: intake ? cleanText(intake.requirements, 20000) : null,
        intakeSubmittedAt: intake ? cleanText(intake.submitted_at, 40) : null,
        projectId: project && ORDER_ID.test(project.id ?? '') ? project.id : null,
        projectStatus: project ? cleanText(project.status, 40) : null,
        customerReference: contact ? cleanText(contact.external_crm_id, 200) : null,
      };
    });
  }

  async function load() {
    const [orders, intakes, projects, contacts] = await Promise.all([
      rest('service_orders', { select: 'id,email,package_id,amount,currency,status,created_at', order: 'created_at.desc', limit: '200' }),
      rest('customer_intakes', { select: 'order_id,business_name,requirements,submitted_at', limit: '200' }),
      rest('fulfillment_projects', { select: 'id,order_id,status,contact_id', limit: '200' }),
      rest('fulfillment_contacts', { select: 'id,external_crm_id', limit: '200' }),
    ]);
    return attach(orders.map(orderRow).filter(Boolean), intakes, projects, contacts);
  }

  return {
    async list(jwt) {
      await caller(jwt);
      const orders = (await load()).map(({ requirements, ...order }) => order);
      return { orders };
    },
    async order(jwt, id) {
      await caller(jwt);
      if (!ORDER_ID.test(id ?? '')) throw Error('Not found');
      const order = (await load()).find(item => item.id === id);
      if (!order) throw Error('Not found');
      return { order };
    },
  };
}
