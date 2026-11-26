import { useMemo, useRef, useState } from 'react';
import { saveWebsiteDraft, websiteError } from '../../lib/crm-website';
import {
  LIBRARY,
  LOOKS,
  applyLook,
  assertDraftReady,
  blankItem,
  insertSection,
  itemFields,
  moveSection,
  moveSectionBy,
  patchSection,
  removeSection,
  type WebsiteDocument,
  type WebsiteSection,
} from '../../lib/website-sections.mjs';
import { WebsiteRenderer, type WebsiteContent } from './WebsiteRenderer';

type DragPayload = { kind: 'library'; type: string } | { kind: 'section'; id: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const controlClass = 'rounded-lg border border-white/15 px-2 py-1 text-xs text-slate-100 disabled:opacity-40';
const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3';

export function SectionStudio({
  accessToken,
  organizationId,
  baseRevisionId,
  initialContent,
  viewport,
  onViewport,
  onSaved,
}: {
  accessToken: string;
  organizationId: string;
  baseRevisionId: string;
  initialContent: WebsiteContent;
  viewport: 'desktop' | 'mobile';
  onViewport: (viewport: 'desktop' | 'mobile') => void;
  onSaved: () => Promise<void>;
}) {
  const dragRef = useRef<DragPayload | null>(null);
  const [content, setContent] = useState<WebsiteContent>(initialContent);
  const [activeSlug, setActiveSlug] = useState('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');

  const draft = content as WebsiteDocument;
  const page = useMemo(
    () => draft.pages?.find(item => item.slug === activeSlug) ?? draft.pages?.[0] ?? null,
    [draft.pages, activeSlug],
  );
  const selected = page?.sections.find(section => section.id === selectedId) ?? null;
  const fields = selected ? itemFields(selected.type) : null;

  function commit(next: WebsiteDocument, selectId?: string) {
    setContent(next as WebsiteContent);
    if (selectId) setSelectedId(selectId);
    setDirty(true);
    setSaveState('idle');
    setError('');
  }

  function fail(reason: unknown, fallback: string) {
    setError(websiteError(reason, fallback));
  }

  function dropAt(index: number) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDropIndex(null);
    if (!drag || !page) return;
    try {
      if (drag.kind === 'library') {
        const result = insertSection(draft, page.slug, index, drag.type);
        commit(result.content, result.sectionId);
      } else {
        commit(moveSection(draft, page.slug, drag.id, index), drag.id);
      }
      setAddMenuIndex(null);
    } catch (reason) {
      fail(reason, 'That section could not be placed.');
    }
  }

  function addHere(index: number, type: string) {
    if (!page) return;
    try {
      const result = insertSection(draft, page.slug, index, type);
      commit(result.content, result.sectionId);
      setAddMenuIndex(null);
    } catch (reason) {
      fail(reason, 'That section could not be added.');
    }
  }

  function moveBy(sectionId: string, direction: number) {
    if (!page) return;
    try {
      commit(moveSectionBy(draft, page.slug, sectionId, direction), sectionId);
    } catch (reason) {
      fail(reason, 'That section could not be moved.');
    }
  }

  function onRemove(sectionId: string) {
    if (!page) return;
    try {
      const next = removeSection(draft, page.slug, sectionId);
      setContent(next as WebsiteContent);
      setSelectedId(current => (current === sectionId ? null : current));
      setDirty(true);
      setSaveState('idle');
      setError('');
    } catch (reason) {
      fail(reason, 'That section could not be removed.');
    }
  }

  function patch(sectionId: string, change: Partial<WebsiteSection>) {
    if (!page) return;
    try {
      commit(patchSection(draft, page.slug, sectionId, change), sectionId);
    } catch (reason) {
      fail(reason, 'That edit could not be applied.');
    }
  }

  function onApplyLook(lookId: string) {
    const replaceSections = window.confirm('This look updates the site colors. OK also replaces the home page sections with its starter stack. Cancel updates colors only.');
    try {
      const next = applyLook(draft, lookId, { replaceSections });
      commit(next);
      if (replaceSections) {
        setActiveSlug('home');
        setSelectedId(next.pages.find(item => item.slug === 'home')?.sections[0]?.id ?? null);
      }
    } catch (reason) {
      fail(reason, 'That look could not be applied.');
    }
  }

  async function onSave() {
    if (!page) return;
    try {
      assertDraftReady(draft);
    } catch (reason) {
      fail(reason, 'This draft could not be saved.');
      setSaveState('failed');
      return;
    }
    setSaveState('saving');
    setError('');
    try {
      await saveWebsiteDraft(accessToken, organizationId, { baseRevisionId, content: draft });
      setDirty(false);
      setSaveState('saved');
      await onSaved();
    } catch (reason) {
      setSaveState('failed');
      fail(reason, 'Draft could not be saved.');
    }
  }

  if (!page) return <p className="text-gray-300">Generate a draft before arranging sections.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Arrange sections</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-300">Drag a whole section onto the page. The line shows where it will land.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`rounded-lg px-3 py-2 text-sm ${viewport === 'desktop' ? 'bg-[#2283B8]' : 'border border-gray-700'}`} onClick={() => onViewport('desktop')}>Desktop</button>
          <button type="button" className={`rounded-lg px-3 py-2 text-sm ${viewport === 'mobile' ? 'bg-[#2283B8]' : 'border border-gray-700'}`} onClick={() => onViewport('mobile')}>Mobile</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Starter looks">
        {LOOKS.map(look => (
          <button key={look.id} type="button" className="rounded-lg border border-gray-700 px-3 py-2 text-sm" onClick={() => onApplyLook(look.id)}>
            {look.label} look
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-400" role="status">
        {saveState === 'saving' && 'Saving…'}
        {saveState === 'saved' && 'Saved. Draft persists after refresh.'}
        {saveState === 'failed' && 'Save failed.'}
        {saveState === 'idle' && (dirty ? 'Unsaved changes' : 'No unsaved changes')}
      </p>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-3 rounded-xl border border-gray-800 bg-[#0d1424] p-4">
          <h3 className="text-sm font-semibold text-white">Section library</h3>
          <label className="block text-sm text-gray-300">
            Page
            <select className="mt-1 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0A0F1E] px-3" value={page.slug} onChange={event => { setActiveSlug(event.target.value); setSelectedId(null); setAddMenuIndex(null); }}>
              {draft.pages.map(item => <option key={item.slug} value={item.slug}>{item.title}</option>)}
            </select>
          </label>
          <ul className="space-y-2">
            {LIBRARY.map(entry => (
              <li key={entry.type}>
                <button
                  type="button"
                  draggable
                  className="w-full cursor-grab rounded-lg border border-gray-700 bg-[#0A0F1E] px-3 py-3 text-left"
                  onDragStart={event => {
                    dragRef.current = { kind: 'library', type: entry.type };
                    event.dataTransfer.setData('text/plain', entry.type);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDragEnd={() => { dragRef.current = null; setDropIndex(null); }}
                >
                  <span className="block text-sm font-semibold text-white">{entry.label}</span>
                  <span className="mt-1 block text-xs text-gray-400">{entry.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          <WebsiteRenderer
            content={content}
            activeSlug={page.slug}
            onNavigate={setActiveSlug}
            viewport={viewport}
            betweenSections={index => (
              <div
                className="relative px-4 py-2"
                onDragOver={event => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = dragRef.current?.kind === 'section' ? 'move' : 'copy';
                  setDropIndex(index);
                }}
                onDrop={event => {
                  event.preventDefault();
                  dropAt(index);
                }}
              >
                <div className={`mx-2 h-1 rounded ${dropIndex === index ? 'bg-[#7dd3f5]' : 'bg-transparent'}`} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button type="button" className={controlClass} onClick={() => setAddMenuIndex(addMenuIndex === index ? null : index)}>
                    Add section here
                  </button>
                  {addMenuIndex === index && LIBRARY.map(entry => (
                    <button key={entry.type} type="button" className={controlClass} onClick={() => addHere(index, entry.type)}>
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            frameSection={(section, index, node) => (
              <div
                data-section-id={section.id}
                className={section.id === selectedId ? 'ring-2 ring-inset ring-[#7dd3f5]' : undefined}
                onClick={() => setSelectedId(section.id)}
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    draggable
                    className={`${controlClass} cursor-grab`}
                    aria-label={`Drag ${section.title || section.type}`}
                    onDragStart={event => {
                      dragRef.current = { kind: 'section', id: section.id };
                      event.dataTransfer.setData('text/plain', section.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => { dragRef.current = null; setDropIndex(null); }}
                  >
                    Drag
                  </button>
                  <button type="button" className={controlClass} aria-label={`Move ${section.title || section.type} up`} disabled={index === 0} onClick={event => { event.stopPropagation(); moveBy(section.id, -1); }}>
                    Move up
                  </button>
                  <button type="button" className={controlClass} aria-label={`Move ${section.title || section.type} down`} disabled={index === page.sections.length - 1} onClick={event => { event.stopPropagation(); moveBy(section.id, 1); }}>
                    Move down
                  </button>
                  <button type="button" className={controlClass} onClick={event => { event.stopPropagation(); onRemove(section.id); }}>
                    Remove
                  </button>
                </div>
                {section.hidden ? <p className="px-6 py-4 text-sm text-slate-400">Hidden on the site.</p> : node}
              </div>
            )}
          />

          {selected && (
            <fieldset className="rounded-xl border border-gray-800 bg-[#0d1424] p-4">
              <legend className="px-1 text-sm font-semibold text-white">Edit {selected.title || selected.type}</legend>
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={selected.hidden === true} onChange={event => patch(selected.id, { hidden: event.target.checked })} />
                Hide section
              </label>
              <label className="mt-3 block text-sm text-gray-300">
                Title
                <input className={fieldClass} value={selected.title || ''} onChange={event => patch(selected.id, { title: event.target.value })} />
              </label>
              <label className="mt-3 block text-sm text-gray-300">
                Body
                <textarea className={`${fieldClass} min-h-28 py-3`} value={selected.body || ''} onChange={event => patch(selected.id, { body: event.target.value })} />
              </label>
              {selected.type !== 'contact_form' && !fields && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-gray-300">
                    Button label
                    <input className={fieldClass} value={selected.ctaLabel || ''} onChange={event => patch(selected.id, { ctaLabel: event.target.value })} />
                  </label>
                  <label className="block text-sm text-gray-300">
                    Button link
                    <input className={fieldClass} value={selected.ctaHref || ''} onChange={event => patch(selected.id, { ctaHref: event.target.value })} />
                  </label>
                </div>
              )}
              {fields && (
                <div className="mt-4 space-y-3">
                  {(selected.items ?? []).map((item, itemIndex) => (
                    <div key={item.key || `${selected.id}-${itemIndex}`} className="rounded-lg border border-gray-800 p-3">
                      <label className="block text-sm text-gray-300">
                        {fields.name}
                        <input className={fieldClass} value={item.name} onChange={event => {
                          const items = (selected.items ?? []).map((entry, index) => index === itemIndex ? { ...entry, name: event.target.value } : entry);
                          patch(selected.id, { items });
                        }} />
                      </label>
                      <label className="mt-3 block text-sm text-gray-300">
                        {fields.description}
                        <textarea className={`${fieldClass} min-h-20 py-3`} value={item.description || ''} onChange={event => {
                          const items = (selected.items ?? []).map((entry, index) => index === itemIndex ? { ...entry, description: event.target.value } : entry);
                          patch(selected.id, { items });
                        }} />
                      </label>
                      <button type="button" className={`${controlClass} mt-3`} onClick={() => {
                        const items = (selected.items ?? []).filter((_, index) => index !== itemIndex);
                        patch(selected.id, { items });
                      }}>
                        Remove {fields.name.toLowerCase()}
                      </button>
                    </div>
                  ))}
                  <button type="button" className={controlClass} disabled={(selected.items?.length ?? 0) >= 12} onClick={() => {
                    const items = [...(selected.items ?? []), blankItem(selected.type, (selected.items?.length ?? 0) + 1)];
                    patch(selected.id, { items });
                  }}>
                    {fields.add}
                  </button>
                </div>
              )}
            </fieldset>
          )}

          <button type="button" disabled={saveState === 'saving' || !dirty} className="min-h-11 rounded-lg bg-[#2283B8] px-4 font-semibold disabled:opacity-50" onClick={() => { void onSave(); }}>
            {saveState === 'saving' ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
