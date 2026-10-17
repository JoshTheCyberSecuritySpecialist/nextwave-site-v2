// Explicit single-batch worker. Caller must authorize external delivery separately.
export async function runOutboxBatch({ rpc, deliver, invitationUrl, now = () => Date.now() }) {
  const jobs = await rpc('p3_outbox_claim', { p_limit: 10 });
  const results = [];
  for (const job of jobs) {
    if (Date.parse(job.lease_until) <= now()) { results.push({ id: job.id, status: 'lease_expired' }); continue; }
    try {
      const receipt = await deliver({ id: job.id, orderId: job.order_id, kind: job.kind, ...(job.kind === 'payment_confirmation' ? { intakeUrl: invitationUrl(job.order_id) } : {}) });
      // If finish fails after provider accepted, preserve lease for retry; never mark provider failure.
      results.push({ id: job.id, receipt });
    } catch {
      await rpc('p3_outbox_finish', { p_job_id: job.id, p_lease_id: job.lease_id, p_success: false, p_error: 'Isolated provider delivery failed; inspect redacted operator logs.' });
      results.push({ id: job.id, status: 'retry_queued' });
      continue;
    }
    const receipt = results.at(-1).receipt;
    await rpc('p3_outbox_finish', { p_job_id: job.id, p_lease_id: job.lease_id, p_success: true, p_external_crm_id: job.kind === 'hubspot_sync' ? receipt.externalId : null });
  }
  return results;
}
