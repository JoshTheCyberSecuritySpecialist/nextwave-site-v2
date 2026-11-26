import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { CrmSelection } from '../../lib/crm';
import { loadPrivateWebsitePreview, websiteError } from '../../lib/crm-website';
import { WebsiteRenderer, type WebsiteContent } from '../../components/website/WebsiteRenderer';

export default function WebsitePreview() {
  const workspace = useOutletContext<CrmSelection>();
  const { session } = useAuth();
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [slug, setSlug] = useState('');
  const [activeSlug, setActiveSlug] = useState('home');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace.websiteEnabled || !session?.access_token) return;
    let stopped = false;
    setLoading(true);
    loadPrivateWebsitePreview(session.access_token, workspace.organizationId)
      .then(preview => {
        if (stopped) return;
        setContent(preview.content as WebsiteContent);
        setSlug(preview.slug);
        setActiveSlug('home');
      })
      .catch(reason => { if (!stopped) setError(websiteError(reason, 'Private preview could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId, workspace.websiteEnabled, session?.access_token]);

  if (!workspace.websiteEnabled) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">This package does not include website preview.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Private preview</h1>
          <p className="mt-2 text-gray-300">Authenticated draft preview only. This is not the public site.</p>
          {slug && <p className="mt-1 text-sm text-gray-400">Future public path: /site/{slug}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/crm/website/edit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Edit</Link>
          <Link to="/crm/website" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Studio</Link>
        </div>
      </div>
      {loading && <p className="text-gray-400">Loading preview…</p>}
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`rounded-lg px-3 py-2 text-sm ${viewport === 'desktop' ? 'bg-[#2283B8]' : 'border border-gray-700'}`} onClick={() => setViewport('desktop')}>Desktop</button>
        <button type="button" className={`rounded-lg px-3 py-2 text-sm ${viewport === 'mobile' ? 'bg-[#2283B8]' : 'border border-gray-700'}`} onClick={() => setViewport('mobile')}>Mobile</button>
      </div>
      {content && <WebsiteRenderer content={content} activeSlug={activeSlug} onNavigate={setActiveSlug} viewport={viewport} />}
    </section>
  );
}
