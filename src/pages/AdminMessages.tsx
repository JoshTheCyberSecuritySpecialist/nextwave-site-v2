import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/payments-client.mjs';

const apiEnv = { dev: import.meta.env.DEV, configured: import.meta.env.VITE_API_BASE_URL };
const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MessageSummary = {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  service: string | null;
  preview: string;
  status: 'open' | 'replied';
  createdAt: string;
};

type MessageDetail = MessageSummary & {
  phone: string | null;
  body: string;
};

type Reply = {
  id: string;
  body: string;
  sentAt: string;
};

function when(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function readJson(response: Response) {
  return await response.json().catch(() => null) as { error?: string; messages?: MessageSummary[]; message?: MessageDetail; replies?: Reply[]; reply?: Reply; status?: string } | null;
}

export default function AdminMessages({ token, messageId, missingId = false }: { token: string; messageId: string; missingId?: boolean }) {
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(!missingId);
  const [error, setError] = useState(missingId ? 'This message was not found.' : '');
  const [replyError, setReplyError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (missingId) return;
    let stopped = false;
    setLoading(true);
    setError('');
    setReplyError('');
    setNotice('');
    const run = async () => {
      const path = messageId ? `/api/admin/messages/${messageId}` : '/api/admin/messages';
      try {
        const response = await fetch(apiUrl(path, apiEnv), { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
        const body = await readJson(response);
        if (stopped) return;
        if (response.status === 401) throw Error('You are not authorized to view messages.');
        if (response.status === 404) throw Error(messageId ? 'This message was not found.' : 'Messages could not be loaded.');
        if (!response.ok || !body) throw Error(body?.error || 'Messages could not be loaded.');
        if (messageId) {
          if (!body.message || !Array.isArray(body.replies)) throw Error('Messages could not be loaded.');
          setMessage(body.message);
          setReplies(body.replies);
        } else {
          if (!Array.isArray(body.messages)) throw Error('Messages could not be loaded.');
          setMessages(body.messages);
        }
      } catch (reason) {
        if (!stopped) setError(reason instanceof Error ? reason.message : 'Messages could not be loaded.');
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    void run();
    return () => { stopped = true; };
  }, [token, messageId, missingId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return messages.filter(item => {
      const matchesQuery = !needle || item.name.toLowerCase().includes(needle) || item.email.toLowerCase().includes(needle) || (item.businessName ?? '').toLowerCase().includes(needle);
      const matchesFilter = filter === 'all' || item.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [messages, query, filter]);

  async function onReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!MESSAGE_ID.test(messageId) || !message) return;
    const body = String(new FormData(event.currentTarget).get('body') ?? '').trim();
    if (body.length < 1 || body.length > 5000) {
      setReplyError('Write a reply of 5,000 characters or fewer.');
      return;
    }
    setSending(true);
    setReplyError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl(`/api/admin/messages/${messageId}/reply`, apiEnv), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body }),
      });
      const payload = await readJson(response);
      if (!response.ok || !payload?.reply) throw Error(payload?.error || 'The reply could not be sent.');
      setReplies(current => [...current, payload.reply as Reply]);
      setMessage(current => current ? { ...current, status: 'replied' } : current);
      setNotice(`Reply sent to ${message.email}.`);
      event.currentTarget.reset();
    } catch (reason) {
      setReplyError(reason instanceof Error ? reason.message : 'The reply could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (messageId || missingId) {
    return (
      <section className="max-w-3xl">
        <Link to="/admin/messages" className="text-sm text-[#7dd3f5] underline">Back to messages</Link>
        {loading && <p className="mt-6 text-gray-300">Loading message…</p>}
        {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
        {message && (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-bold">{message.name}</h1>
              <p className="text-sm uppercase tracking-wide text-[#7dd3f5]">{message.status === 'replied' ? 'Replied' : 'Open'}</p>
            </div>
            <dl className="mt-6 space-y-4 rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">
              <div><dt className="text-sm text-gray-400">Email</dt><dd><a className="text-[#7dd3f5] underline" href={`mailto:${message.email}`}>{message.email}</a></dd></div>
              <div><dt className="text-sm text-gray-400">Phone</dt><dd>{message.phone || 'Not provided'}</dd></div>
              <div><dt className="text-sm text-gray-400">Business</dt><dd>{message.businessName || 'Not provided'}</dd></div>
              <div><dt className="text-sm text-gray-400">Service</dt><dd>{message.service || 'Not provided'}</dd></div>
              <div><dt className="text-sm text-gray-400">Received</dt><dd>{when(message.createdAt)}</dd></div>
              <div><dt className="text-sm text-gray-400">Message</dt><dd className="whitespace-pre-wrap">{message.body}</dd></div>
            </dl>
            <section className="mt-8">
              <h2 className="text-xl font-semibold">Replies</h2>
              {replies.length === 0 ? <p className="mt-3 text-gray-300">No replies have been sent.</p> : (
                <ul className="mt-4 space-y-3">
                  {replies.map(reply => (
                    <li key={reply.id} className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
                      <p className="whitespace-pre-wrap">{reply.body}</p>
                      <p className="mt-2 text-sm text-gray-400">{when(reply.sentAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <form className="mt-8 space-y-3" onSubmit={onReply}>
              <label htmlFor="reply-body" className="block text-sm text-gray-300">Reply by email</label>
              <textarea id="reply-body" name="body" required maxLength={5000} rows={6} className="w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 py-2" />
              {replyError && <p role="alert" className="text-red-200">{replyError}</p>}
              {notice && <p role="status" className="text-[#7dd3f5]">{notice}</p>}
              <button type="submit" disabled={sending} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">{sending ? 'Sending…' : 'Send reply'}</button>
            </form>
          </>
        )}
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-3xl font-bold">Messages</h1>
      <p className="mt-3 max-w-2xl text-gray-300">These are messages submitted through the contact form. Open one to read it and send a reply to the address they gave.</p>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={event => event.preventDefault()}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, or business" className="min-h-11 flex-1 rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" />
        <select value={filter} onChange={event => setFilter(event.target.value)} className="min-h-11 rounded-lg border border-gray-700 bg-[#0A0F1E] px-3">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="replied">Replied</option>
        </select>
      </form>
      {loading && <p className="mt-6 text-gray-300">Loading messages…</p>}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {!loading && !error && visible.length === 0 && <p className="mt-6 text-gray-300">{messages.length === 0 ? 'No messages have been received yet.' : 'No messages match this view.'}</p>}
      {!loading && !error && visible.length > 0 && (
        <ul className="mt-6 space-y-3">
          {visible.map(item => (
            <li key={item.id}>
              <Link to={`/admin/messages/${item.id}`} className="block rounded-xl border border-gray-800 bg-[#0d1424] p-4 hover:border-[#2283B8]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-400">{when(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-gray-300">{item.email}{item.service ? ` · ${item.service}` : ''}</p>
                <p className="mt-2 text-gray-200">{item.preview}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-[#7dd3f5]">{item.status === 'replied' ? 'Replied' : 'Open'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
