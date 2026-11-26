import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { CrmSelection } from '../../lib/crm';
import { loadWebsiteStatus, saveWebsiteDraft, websiteError } from '../../lib/crm-website';
import { WebsiteRenderer, type WebsiteContent } from '../../components/website/WebsiteRenderer';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function cloneContent(content: WebsiteContent): WebsiteContent {
  return JSON.parse(JSON.stringify(content)) as WebsiteContent;
}

export default function WebsiteEditor() {
  const workspace = useOutletContext<CrmSelection>();
  const { session } = useAuth();
  const [baseRevisionId, setBaseRevisionId] = useState('');
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [activeSlug, setActiveSlug] = useState('home');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!workspace.websiteEnabled || !session?.access_token) return;
    let stopped = false;
    setLoading(true);
    loadWebsiteStatus(session.access_token, workspace.organizationId)
      .then(status => {
        if (stopped) return;
        if (!status.draftRevision?.content || !status.draftRevision.id) {
          setError('Generate a draft website before editing.');
          return;
        }
        setBaseRevisionId(status.draftRevision.id);
        setContent(cloneContent(status.draftRevision.content as WebsiteContent));
        setActiveSlug('home');
        setDirty(false);
        setSaveState('idle');
      })
      .catch(reason => { if (!stopped) setError(websiteError(reason, 'Draft could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [workspace.organizationId, workspace.websiteEnabled, session?.access_token]);

  const page = useMemo(
    () => content?.pages?.find(item => item.slug === activeSlug) ?? content?.pages?.[0] ?? null,
    [content, activeSlug],
  );

  function updateSection(sectionId: string, patch: Partial<{ title: string; body: string; ctaLabel: string; ctaHref: string; hidden: boolean }>) {
    if (!content || !page) return;
    const next = cloneContent(content);
    const nextPage = next.pages?.find(item => item.slug === page.slug);
    const section = nextPage?.sections?.find(item => item.id === sectionId);
    if (!section) return;
    Object.assign(section, patch);
    setContent(next);
    setDirty(true);
    setSaveState('idle');
  }

  function updatePageMeta(patch: Partial<{ title: string; description: string }>) {
    if (!content || !page) return;
    const next = cloneContent(content);
    const nextPage = next.pages?.find(item => item.slug === page.slug);
    if (!nextPage) return;
    Object.assign(nextPage, patch);
    if (next.meta && page.slug === 'home' && patch.title) next.meta.title = patch.title;
    setContent(next);
    setDirty(true);
    setSaveState('idle');
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!session?.access_token || !content || !baseRevisionId) return;
    setSaveState('saving');
    setError('');
    try {
      const saved = await saveWebsiteDraft(session.access_token, workspace.organizationId, {
        baseRevisionId,
        content,
        clearUnfinished: true,
      });
      setBaseRevisionId(saved.revisionId);
      setContent(cloneContent(saved.content as WebsiteContent));
      setDirty(false);
      setSaveState('saved');
    } catch (reason) {
      setSaveState('failed');
      setError(websiteError(reason, 'Draft could not be saved.'));
    }
  }

  if (!workspace.websiteEnabled) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-5 text-gray-200">This package does not include website editing.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Website editor</h1>
          <p className="mt-2 text-gray-300">Edit section text, visibility, and page metadata. Saves create a new draft revision.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/crm/website" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Studio</Link>
          <Link to="/crm/website/preview" className="rounded-lg border border-gray-700 px-4 py-2 text-sm">Private preview</Link>
        </div>
      </div>

      <p className="text-sm text-gray-400">
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved. Draft persists after refresh.'}
        {saveState === 'failed' && 'Save failed.'}
        {saveState === 'idle' && (dirty ? 'Unsaved changes' : 'No unsaved changes')}
      </p>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {loading && <p className="text-gray-400">Loading draft…</p>}

      {content && page && (
        <form className="grid gap-6 lg:grid-cols-2" onSubmit={event => { void onSave(event); }}>
          <div className="space-y-4">
            <label className="block text-sm text-gray-300">
              Page
              <select className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3" value={page.slug} onChange={event => setActiveSlug(event.target.value)}>
                {content.pages?.map(item => <option key={item.slug} value={item.slug}>{item.title}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gray-300">
              Page title
              <input className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3" value={page.title} onChange={event => updatePageMeta({ title: event.target.value })} />
            </label>
            <label className="block text-sm text-gray-300">
              Page description
              <textarea className="mt-1 min-h-24 w-full rounded-lg border border-gray-700 bg-[#0d1424] px-3 py-3" value={page.description || ''} onChange={event => updatePageMeta({ description: event.target.value })} />
            </label>
            {page.sections.map(section => (
              <fieldset key={section.id} className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
                <legend className="px-1 text-sm font-semibold text-white">{section.type} · {section.id}</legend>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={section.hidden === true} onChange={event => updateSection(section.id, { hidden: event.target.checked })} />
                  Hide section
                </label>
                <label className="mt-3 block text-sm text-gray-300">
                  Title
                  <input className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" value={section.title || ''} onChange={event => updateSection(section.id, { title: event.target.value })} />
                </label>
                <label className="mt-3 block text-sm text-gray-300">
                  Body
                  <textarea className="mt-1 min-h-28 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 py-3" value={section.body || ''} onChange={event => updateSection(section.id, { body: event.target.value })} />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-gray-300">
                    CTA label
                    <input className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" value={section.ctaLabel || ''} onChange={event => updateSection(section.id, { ctaLabel: event.target.value })} />
                  </label>
                  <label className="block text-sm text-gray-300">
                    CTA href
                    <input className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" value={section.ctaHref || ''} onChange={event => updateSection(section.id, { ctaHref: event.target.value })} />
                  </label>
                </div>
              </fieldset>
            ))}
            <button type="submit" disabled={saveState === 'saving' || !dirty} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50">
              {saveState === 'saving' ? 'Saving…' : 'Save draft'}
            </button>
          </div>
          <div>
            <p className="mb-3 text-sm text-gray-400">Live draft preview</p>
            <WebsiteRenderer content={content} activeSlug={activeSlug} onNavigate={setActiveSlug} viewport="desktop" />
          </div>
        </form>
      )}
    </section>
  );
}
