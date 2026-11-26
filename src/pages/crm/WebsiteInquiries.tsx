import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CrmSelection } from '../../lib/crm';
import { inquiryError, listWebsiteInquiries, type WebsiteInquiry } from '../../lib/crm-inquiries';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function WebsiteInquiries() {
  const workspace = useOutletContext<CrmSelection>();
  const [rows, setRows] = useState<WebsiteInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!workspace.websiteEnabled) return;
    let stopped = false;
    setLoading(true);
    setError('');
    listWebsiteInquiries(workspace.organizationId)
      .then(next => { if (!stopped) setRows(next); })
      .catch(reason => { if (!stopped) setError(inquiryError(reason, 'Inquiries could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId, workspace.websiteEnabled]);

  if (!workspace.websiteEnabled) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">Website inquiries are not included in this package.</p>;
  }

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold">Website inquiries</h1>
      <p className="mt-2 text-gray-300">Messages from the published site contact form. These are not CRM customer records.</p>
      {loading && <div className="mt-6 h-40 animate-pulse rounded-xl bg-[#0d1424]" />}
      {error && <p role="alert" className="mt-6 text-red-200">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="mt-6 text-gray-300">No inquiries yet.</p>}
      {!loading && !error && rows.length > 0 && (
        <ul className="mt-6 space-y-3">
          {rows.map(row => (
            <li key={row.id} className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-sm text-gray-300">{row.email}{row.phone ? ` · ${row.phone}` : ''}</p>
                </div>
                <p className="text-sm text-gray-400">{when(row.created_at)}</p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-gray-200">{row.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
