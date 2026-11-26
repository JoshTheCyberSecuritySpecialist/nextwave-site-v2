import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { CrmSelection } from '../../lib/crm';
import {
  generateWebsite,
  listWebsiteRevisions,
  loadWebsiteStatus,
  publishWebsite,
  rollbackWebsite,
  websiteError,
  type WebsiteStatus,
} from '../../lib/crm-website';
import { WebsiteRenderer, type WebsiteContent } from '../../components/website/WebsiteRenderer';

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `gen_${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`;
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function WebsiteStudio() {
  const workspace = useOutletContext<CrmSelection>();
  const { session } = useAuth();
  const [status, setStatus] = useState<WebsiteStatus | null>(null);
  const [revisions, setRevisions] = useState<Array<{ id: string; revisionNumber: number; state: string; unfinished: string[] }>>([]);
  const [publicPath, setPublicPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSlug, setActiveSlug] = useState('home');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  async function refresh() {
    if (!session?.access_token) return;
    const [next, history] = await Promise.all([
      loadWebsiteStatus(session.access_token, workspace.organizationId),
      listWebsiteRevisions(session.access_token, workspace.organizationId),
    ]);
    setStatus(next);
    setRevisions(history.revisions);
    setPublicPath(history.website.publicPath);
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
    setBusy('generate');
    setError('');
    setNotice('');
    try {
      const result = await generateWebsite(session.access_token, workspace.organizationId, newIdempotencyKey());
      await refresh();
      if (result.fixture) setNotice('Fixture draft saved for local testing. This is not live AI generation.');
      else if (result.duplicate) setNotice('Existing generation result reused.');
      else setNotice('Draft website generated and saved.');
      setActiveSlug('home');
    } catch (reason) {
      setError(websiteError(reason, 'Website generation failed.'));
      try { await refresh(); } catch { /* keep original error */ }
    } finally {
      setBusy('');
    }
  }

  async function onPublish() {
    if (!session?.access_token || !status?.draftRevision?.id) return;
    setBusy('publish');
    setError('');
    setNotice('');
    try {
      const result = await publishWebsite(session.access_token, workspace.organizationId, status.draftRevision.id);
      await refresh();
      setPublicPath(result.publicPath);
      setNotice(`Published to ${result.publicPath}`);
    } catch (reason) {
      setError(websiteError(reason, 'Publish failed. The live site was left unchanged.'));
      try { await refresh(); } catch { /* keep original error */ }
    } finally {
      setBusy('');
    }
  }

  async function onRollback(revisionId: string) {
    if (!session?.access_token) return;
    setBusy(`rollback:${revisionId}`);
    setError('');
    setNotice('');
    try {
      const result = await rollbackWebsite(session.access_token, workspace.organizationId, revisionId);
      await refresh();
      setPublicPath(result.publicPath ?? publicPath);
      setNotice(result.duplicate ? 'That revision is already live.' : 'Earlier published revision restored.');
    } catch (reason) {
      setError(websiteError(reason, 'Rollback failed. The live site was left unchanged.'));
    } finally {
      setBusy('');
    }
  }

  if (!workspace.websiteEnabled) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">This package does not include website generation.</p>;
  }

  const content = (status?.draftRevision?.content ?? null) as WebsiteContent | null;
  const remaining = Math.max(0, (status?.maxGenerationRuns ?? 0) - (status?.usedGenerationRuns ?? 0));
  const unfinished = Array.isArray((content as WebsiteContent | null)?.unfinished)
    ? (content as WebsiteContent).unfinished ?? []
    : [];

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Website</h1>
          <p className="mt-2 max-w-2xl text-gray-300">
            Generate, edit, privately preview, then publish to a unique platform URL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/crm/website/intake" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Intake</Link>
          <Link to="/crm/website/edit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Editor</Link>
          <Link to="/crm/website/preview" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Private preview</Link>
        </div>
      </div>

      {loading && <p className="text-gray-400">Loading website status…</p>}
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-[#2283B8]/30 bg-[#2283B8]/10 p-4 text-sm text-[#7dd3f5]">{notice}</p>}

      {status && (
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Intake</p>
            <p className="mt-2 text-xl font-semibold">{status.intakeComplete ? 'Complete' : 'Incomplete'}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Draft / live</p>
            <p className="mt-2 text-xl font-semibold">{status.website?.status ?? 'draft'}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Generation runs left</p>
            <p className="mt-2 text-xl font-semibold">{remaining} / {status.maxGenerationRuns}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
            <p className="text-sm text-gray-400">Public URL</p>
            <p className="mt-2 text-sm font-semibold break-all">
              {publicPath ? <a className="text-[#7dd3f5] underline-offset-4 hover:underline" href={publicPath}>{publicPath}</a> : 'Not published'}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!!busy || !status?.intakeComplete || remaining <= 0} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50" onClick={() => { void onGenerate(); }}>
          {busy === 'generate' ? 'Generating…' : 'Generate draft'}
        </button>
        <button type="button" disabled={!!busy || !status?.draftRevision?.id || unfinished.length > 0} className="min-h-11 rounded-lg border border-[#2BB0E8] px-4 font-semibold disabled:opacity-50" onClick={() => { void onPublish(); }}>
          {busy === 'publish' ? 'Publishing…' : 'Publish draft'}
        </button>
        {!status?.intakeComplete && <p className="self-center text-sm text-amber-200">Finish website intake before generating.</p>}
        {unfinished.length > 0 && <p className="self-center text-sm text-amber-200">Clear unfinished items in the editor before publishing.</p>}
      </div>

      {revisions.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-[#0d1424] p-5">
          <h2 className="text-lg font-semibold">Revisions</h2>
          <ul className="mt-4 space-y-3">
            {revisions.map(revision => (
              <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3 text-sm">
                <div>
                  <p className="font-semibold text-white">Revision {revision.revisionNumber} · {revision.state}</p>
                  {revision.unfinished?.length > 0 && <p className="text-amber-200">Has unfinished items</p>}
                  {status?.website?.publishedRevisionId === revision.id && <p className="text-[#7dd3f5]">Currently live</p>}
                </div>
                <button
                  type="button"
                  disabled={!!busy || status?.website?.publishedRevisionId === revision.id || !status?.website?.publishedRevisionId}
                  className="rounded-lg border border-gray-700 px-3 py-2 disabled:opacity-50"
                  onClick={() => { void onRollback(revision.id); }}
                >
                  {busy === `rollback:${revision.id}` ? 'Restoring…' : 'Restore live'}
                </button>
              </li>
            ))}
          </ul>
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
