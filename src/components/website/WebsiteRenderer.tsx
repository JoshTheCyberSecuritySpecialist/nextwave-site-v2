type Section = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  items?: Array<{ key?: string; name: string; description?: string }>;
  hidden?: boolean;
};

type Page = {
  type: string;
  slug: string;
  title: string;
  description?: string;
  sections: Section[];
};

export type WebsiteContent = {
  schemaVersion?: number;
  pages?: Page[];
  theme?: { primary?: string; secondary?: string; font?: string };
  navigation?: Array<{ label: string; href: string }>;
  meta?: { title?: string; description?: string };
  unfinished?: string[];
};

function SectionView({ section, primary }: { section: Section; primary: string }) {
  if (section.hidden) return null;
  if (section.type === 'hero') {
    return (
      <section className="px-6 py-16 sm:px-10" style={{ background: `linear-gradient(160deg, ${primary}22, transparent)` }}>
        <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>Business website</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">{section.title}</h1>
        {section.body && <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">{section.body}</p>}
        {section.ctaLabel && (
          <a href={section.ctaHref || '#contact'} className="mt-8 inline-flex min-h-11 items-center rounded-lg px-5 font-semibold text-white" style={{ backgroundColor: primary }}>
            {section.ctaLabel}
          </a>
        )}
      </section>
    );
  }
  if (section.type === 'services_list') {
    return (
      <section className="px-6 py-12 sm:px-10">
        {section.title && <h2 className="text-3xl font-bold text-white">{section.title}</h2>}
        {section.body && <p className="mt-3 max-w-2xl text-slate-300">{section.body}</p>}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {(section.items ?? []).map(item => (
            <li key={item.key || item.name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xl font-semibold text-white">{item.name}</h3>
              {item.description && <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className="px-6 py-12 sm:px-10" id={section.id}>
      {section.title && <h2 className="text-3xl font-bold text-white">{section.title}</h2>}
      {section.body && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-slate-300">{section.body}</p>}
      {section.ctaLabel && (
        <a href={section.ctaHref || '#'} className="mt-6 inline-flex min-h-11 items-center rounded-lg px-5 font-semibold text-white" style={{ backgroundColor: primary }}>
          {section.ctaLabel}
        </a>
      )}
    </section>
  );
}

export function WebsiteRenderer({
  content,
  activeSlug = 'home',
  onNavigate,
  viewport = 'desktop',
}: {
  content: WebsiteContent | null | undefined;
  activeSlug?: string;
  onNavigate?: (slug: string) => void;
  viewport?: 'desktop' | 'mobile';
}) {
  if (!content?.pages?.length) {
    return <p className="rounded-xl border border-gray-800 bg-[#0d1424] p-6 text-gray-300">No draft content yet.</p>;
  }
  const primary = content.theme?.primary || '#2283B8';
  const secondary = content.theme?.secondary || '#0A0F1E';
  const page = content.pages.find(item => item.slug === activeSlug) ?? content.pages[0];
  const widthClass = viewport === 'mobile' ? 'mx-auto max-w-sm' : 'w-full';

  return (
    <div className={widthClass}>
      {(content.unfinished?.length ?? 0) > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Unfinished before publish</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {content.unfinished?.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}
      <article className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ backgroundColor: secondary, fontFamily: content.theme?.font || 'Source Sans 3, sans-serif' }}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <p className="text-sm font-semibold text-white">{content.meta?.title || page.title}</p>
          <nav className="flex flex-wrap gap-2">
            {(content.navigation ?? []).map(item => {
              const slug = item.href === '/' ? 'home' : item.href.replace(/^\//, '');
              return (
                <button
                  key={`${item.href}-${item.label}`}
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                  onClick={() => onNavigate?.(slug)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>
        {page.sections.map(section => <SectionView key={section.id} section={section} primary={primary} />)}
      </article>
    </div>
  );
}
