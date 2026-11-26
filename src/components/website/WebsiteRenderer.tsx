import { FormEvent, useState } from 'react';

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

export type WebsiteInquiryInput = {
  name: string;
  email: string;
  phone: string;
  body: string;
};

function isInternalPageHref(href: string) {
  return href === '/' || /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(href);
}

function CtaLink({
  href,
  label,
  primary,
  onNavigate,
}: {
  href: string;
  label: string;
  primary: string;
  onNavigate?: (slug: string) => void;
}) {
  const className = 'mt-6 inline-flex min-h-11 items-center rounded-lg px-5 font-semibold text-white';
  if (href.startsWith('/book/')) {
    return <a href={href} className={className} style={{ backgroundColor: primary }}>{label}</a>;
  }
  if (isInternalPageHref(href) && onNavigate) {
    const slug = href === '/' ? 'home' : href.replace(/^\//, '');
    return (
      <button type="button" className={className} style={{ backgroundColor: primary }} onClick={() => onNavigate(slug)}>
        {label}
      </button>
    );
  }
  return <a href={href || '#contact'} className={className} style={{ backgroundColor: primary }}>{label}</a>;
}

function ContactFormSection({
  section,
  primary,
  onSubmitInquiry,
}: {
  section: Section;
  primary: string;
  onSubmitInquiry?: (input: WebsiteInquiryInput) => Promise<void>;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSubmitInquiry) {
      setError('Contact form is unavailable in this preview.');
      setStatus('failed');
      return;
    }
    const form = new FormData(event.currentTarget);
    setStatus('sending');
    setError('');
    try {
      await onSubmitInquiry({
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        body: String(form.get('body') ?? ''),
      });
      setStatus('sent');
      event.currentTarget.reset();
    } catch (reason) {
      setStatus('failed');
      setError(reason instanceof Error && reason.message ? reason.message : 'Message could not be sent.');
    }
  }

  return (
    <section className="px-6 py-12 sm:px-10" id={section.id}>
      {section.title && <h2 className="text-3xl font-bold text-white">{section.title}</h2>}
      {section.body && <p className="mt-3 max-w-2xl text-slate-300">{section.body}</p>}
      <form className="mt-6 max-w-xl space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm text-slate-300">Name<input name="name" required maxLength={120} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3" /></label>
        <label className="block text-sm text-slate-300">Email<input name="email" type="email" required maxLength={254} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3" /></label>
        <label className="block text-sm text-slate-300">Phone<input name="phone" maxLength={40} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3" /></label>
        <label className="block text-sm text-slate-300">Message<textarea name="body" required maxLength={4000} rows={5} className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2" /></label>
        {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
        {status === 'sent' && <p role="status" className="text-sm text-emerald-200">Message sent. The business will follow up.</p>}
        <button type="submit" disabled={status === 'sending' || !onSubmitInquiry} className="min-h-11 rounded-lg px-5 font-semibold text-white disabled:opacity-50" style={{ backgroundColor: primary }}>
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </section>
  );
}

function SectionView({
  section,
  primary,
  onNavigate,
  onSubmitInquiry,
}: {
  section: Section;
  primary: string;
  onNavigate?: (slug: string) => void;
  onSubmitInquiry?: (input: WebsiteInquiryInput) => Promise<void>;
}) {
  if (section.hidden) return null;
  if (section.type === 'contact_form') {
    return <ContactFormSection section={section} primary={primary} onSubmitInquiry={onSubmitInquiry} />;
  }
  if (section.type === 'hero') {
    return (
      <section className="px-6 py-16 sm:px-10" style={{ background: `linear-gradient(160deg, ${primary}22, transparent)` }}>
        <p className="text-sm font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>Business website</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">{section.title}</h1>
        {section.body && <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">{section.body}</p>}
        {section.ctaLabel && (
          <div className="mt-2">
            <CtaLink href={section.ctaHref || '#contact'} label={section.ctaLabel} primary={primary} onNavigate={onNavigate} />
          </div>
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
        <CtaLink href={section.ctaHref || '#'} label={section.ctaLabel} primary={primary} onNavigate={onNavigate} />
      )}
    </section>
  );
}

export function WebsiteRenderer({
  content,
  activeSlug = 'home',
  onNavigate,
  onSubmitInquiry,
  viewport = 'desktop',
}: {
  content: WebsiteContent | null | undefined;
  activeSlug?: string;
  onNavigate?: (slug: string) => void;
  onSubmitInquiry?: (input: WebsiteInquiryInput) => Promise<void>;
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
        {page.sections.map(section => (
          <SectionView
            key={section.id}
            section={section}
            primary={primary}
            onNavigate={onNavigate}
            onSubmitInquiry={onSubmitInquiry}
          />
        ))}
      </article>
    </div>
  );
}
