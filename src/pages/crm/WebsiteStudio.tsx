import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { CrmSelection } from '../../lib/crm';
import { generateWebsite, loadWebsiteStatus, websiteError, type WebsiteStatus } from '../../lib/crm-website';
import { WebsiteRenderer, type WebsiteContent } from '../../components/website/WebsiteRenderer';

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `gen_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function WebsiteStudio() {
  const workspace = useOutletContext<CrmSelection>();
  const { session } = useAuth();
  const [status, setStatus] = useState<WebsiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSlug, setActiveSlug] = useState('home');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  async function refresh() {
    if (!session?.access_token) return;
    const next = await loadWebsiteStatus(session.access_token, workspace.organizationId);
    setStatus(next);
  }

  useEffect(() => {
    if (!workspace.websiteEnabled) return;
    let stopped = false;
    setLoading(true);
    setError('');
    refresh()
      .catch(reason => { if (!stopped) setError(websiteError(reason, 'Website status could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId, workspace.websiteEnabled, session?.access_token]);

  async function onGenerate() {
    if (!session?.access_token) return;
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const result = await generateWebsite(session.access_token, workspace.organizationId, newIdempotencyKey());
      await refresh();
      if (result.fixture) {
        setNotice('Fixture draft saved for local testing. This is not live AI generation.');
      } else if (result.duplicate) {
        setNotice('Existing generation result reused.');
      } else {
        setNotice('Draft website generated and saved.');
      }
      setActiveSlug('home');
    } catch (reason) {
      setError(websiteError(reason, 'Website generation failed.'));
      try { await refresh(); } catch { /* keep original error */ }
    } finally {
      setGenerating(false);
    }
  }

  if (!workspace.websiteEnabled) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">This package does not include website generation.</p>;
  }

  const content = (status?.draftRevision?.content ?? null) as WebsiteContent | null;
  const remaining = Math.max(0, (status?.maxGenerationRuns ?? 0) - (status?.usedGenerationRuns ?? 0));

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Website</h1>
          <p className="mt-2 max-w-2xl text-gray-300">
            Complete intake, generate a structured draft, then preview it here. Publishing to a public URL arrives in Milestone 3.
          </p>
        </div>
        <Link to="/crm/website/intake" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Edit intake</Link>
      </div>

      {loading && <p className="text-gray-400">Loading website status…</p>}
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-[#2283B8]/30 bg-[#2283B8]/10 p-4 text-sm text-[#7dd3f5]">{notice}</p>}

      {status && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Intake</p>
            <p className="mt-2 text-xl font-semibold">{status.intakeComplete ? 'Complete' : 'Incomplete'}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Package pages</p>
            <p className="mt-2 text-xl font-semibold">Up to {status.maxPages}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Generation runs left</p>
            <p className="mt-2 text-xl font-semibold">{remaining} / {status.maxGenerationRuns}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={generating || !status?.intakeComplete || remaining <= 0}
          className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50"
          onClick={() => { void onGenerate(); }}
        >
          {generating ? 'Generating…' : 'Generate draft website'}
        </button>
        {!status?.intakeComplete && <p className="self-center text-sm text-amber-200">Finish website intake before generating.</p>}
      </div>

      {status?.jobs?.[0] && (
        <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-sm text-gray-300">
          <p>Latest job: <span className="font-semibold text-white">{status.jobs[0].status}</span>
            {status.jobs[0].provider ? ` · ${status.jobs[0].provider}` : ''}
            {status.jobs[0].errorMessage ? ` · ${status.jobs[0].errorMessage}` : ''}
          </p>
        </div>
      )}

      {content && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`rounded-lg px-3 py-2 text-sm ${viewport === 'desktop' ? 'bg-[#2283B8]' : 'border border-gray-700'}`} onClick={() => setViewport('desktop')}>Desktop</button>
            <button type="button" className={`rounded-lg px-3 py-2 text-sm ${viewport === 'mobile' ? 'bg-[#2283B8]' : 'border border-gray-700'}`} onClick={() => setViewport('mobile')}>Mobile</button>
          </div>
          <WebsiteRenderer content={content} activeSlug={activeSlug} onNavigate={setActiveSlug} viewport={viewport} />
        </div>
      )}
    </section>
  );
}
