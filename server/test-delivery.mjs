// Explicitly invoked test-only adapters. Never run automatically at server startup.
export function testDelivery({ resendKey, hubspotToken, testEmail, fromEmail, enabled = false, fetchImpl = fetch }) {
  if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) throw Error('An isolated test recipient is required');
  return async function deliver(job) {
    if (!enabled || process.env.NODE_ENV === 'production') throw Error('External test delivery is disabled');
    if (!job.id || !job.orderId) throw Error('Invalid delivery job');
    let response;
    if (['payment_confirmation', 'intake_confirmation'].includes(job.kind)) {
      if (!resendKey || !fromEmail) throw Error('Resend test configuration required');
      response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id },
        body: JSON.stringify({ from: fromEmail, to: [testEmail], subject: `Next Wave TEST ${job.kind}`, text: `Test order ${job.orderId}. No recurring plan activated.${job.intakeUrl ? ` Intake: ${job.intakeUrl}` : ''}` }),
      });
    } else if (job.kind === 'hubspot_sync') {
      if (!hubspotToken) throw Error('Isolated HubSpot test account required');
      response = await fetchImpl('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
        method: 'POST', headers: { Authorization: `Bearer ${hubspotToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: [{ idProperty: 'email', id: testEmail, properties: { email: testEmail, lifecyclestage: 'customer' } }] }),
      });
    } else throw Error('Unsupported delivery job');
    if (!response.ok) throw Error(`Test delivery failed (${response.status})`);
    const result = await response.json();
    return { delivered: true, externalId: result.id ?? result.results?.[0]?.id ?? null };
  };
}
