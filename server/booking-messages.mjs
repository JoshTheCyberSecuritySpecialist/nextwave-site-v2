// One explicit batch. The caller decides when a provider may be contacted.
const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeBookingHtml(value) {
  return String(value).replace(/[&<>"']/g, character => htmlEscapes[character]);
}

export async function runBookingMessageBatch({ rpc, deliver, now = () => Date.now() }) {
  const jobs = await rpc('booking_messages_claim', { p_limit: 10 });
  const results = [];
  for (const job of jobs) {
    if (Date.parse(job.lease_until) <= now()) {
      results.push({ id: job.id, status: 'lease_expired' });
      continue;
    }
    try {
      await deliver({
        id: job.id,
        to: job.recipient_email,
        subject: job.subject,
        text: job.body,
        html: `<p>${escapeBookingHtml(job.body).replaceAll('\n', '<br>')}</p>`,
        idempotencyKey: job.id,
      });
    } catch {
      await rpc('booking_messages_finish', {
        p_message_id: job.id,
        p_lease_id: job.lease_id,
        p_success: false,
        p_error: 'Booking message delivery failed.',
      });
      results.push({ id: job.id, status: 'retry_queued' });
      continue;
    }
    const finished = await rpc('booking_messages_finish', {
      p_message_id: job.id,
      p_lease_id: job.lease_id,
      p_success: true,
    });
    results.push({ id: job.id, status: finished?.status ?? 'sent' });
  }
  return results;
}
