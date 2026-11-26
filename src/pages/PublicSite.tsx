import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WebsiteRenderer, type WebsiteContent } from '../components/website/WebsiteRenderer';
import { loadPublicWebsite, publicWebsiteError, submitWebsiteInquiry } from '../lib/public-website';

export default function PublicSite() {
  const { slug = '' } = useParams();
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [bookingPath, setBookingPath] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState('home');
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError('');
    setMissing(false);
    loadPublicWebsite(slug)
      .then(page => {
        if (stopped) return;
        if (!page) {
          setMissing(true);
          return;
        }
        setBusinessName(page.organization_name);
        setContent(page.content as WebsiteContent);
        setBookingPath(page.booking_enabled && page.booking_path ? page.booking_path : null);
        setActiveSlug('home');
      })
      .catch(reason => { if (!stopped) setError(publicWebsiteError(reason, 'This website could not be loaded.')); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [slug]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0A0F1E] text-gray-300">Loading…</main>;
  }

  if (missing) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0F1E] px-4 text-center text-white">
        <h1 className="text-3xl font-bold">Website unavailable</h1>
        <p className="mt-3 max-w-md text-gray-300">No published site exists for this address.</p>
        <Link to="/" className="mt-6 text-[#7dd3f5] underline-offset-4 hover:underline">Back to Next Wave</Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0F1E] px-4 text-red-200">
        <p role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071018] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">{businessName}</p>
          {bookingPath && (
            <Link to={bookingPath} className="rounded-lg bg-[#2283B8] px-4 py-2 text-sm font-semibold text-white">
              Book online
            </Link>
          )}
        </div>
        <WebsiteRenderer
          content={content}
          activeSlug={activeSlug}
          onNavigate={setActiveSlug}
          onSubmitInquiry={input => submitWebsiteInquiry(slug, input).then(() => undefined)}
          viewport="desktop"
        />
      </div>
    </main>
  );
}
