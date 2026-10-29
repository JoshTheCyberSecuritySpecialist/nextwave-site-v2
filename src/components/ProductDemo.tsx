import { useEffect, useState } from 'react';

type VideoStatus = 'loading' | 'ready' | 'error';

const VIDEO_SRC = '/videos/nextwave-crm-demo.mp4';
const POSTER_SRC = '/videos/nextwave-crm-demo-poster.jpg';

export function ProductDemo() {
  const [status, setStatus] = useState<VideoStatus>('loading');
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (status !== 'loading') {
      return;
    }

    const timeoutId = window.setTimeout(() => setShowLoading(true), 300);
    return () => window.clearTimeout(timeoutId);
  }, [status]);

  const statusText =
    status === 'error'
      ? 'Demonstration video failed to load.'
      : status === 'ready'
        ? 'Demonstration video ready. Press play to start. Audio stays off until you press play.'
        : 'Loading demonstration video.';

  return (
    <figure id="demo" className="w-full min-w-0 max-w-[960px] scroll-mt-28">
      <figcaption className="text-sm font-semibold uppercase tracking-wide text-[#7dd3f5]">
        Video demonstration
      </figcaption>
      <div className="relative mt-3 aspect-video overflow-hidden rounded-2xl border border-[#2283B8]/40 bg-[#001F33] shadow-lg shadow-black/25 transition-[border-color,box-shadow] duration-200 hover:border-[#2BB0E8]/70 hover:shadow-xl hover:shadow-[#2283B8]/15 motion-reduce:transition-none">
        {status === 'error' ? (
          <div role="alert" className="flex h-full items-center justify-center p-6 text-center">
            <p className="max-w-md text-base leading-7 text-slate-200">
              The demonstration could not be loaded. Compare the booking and website packages below, or{' '}
              <a className="text-[#7dd3f5] underline underline-offset-4" href={VIDEO_SRC}>
                open the video file
              </a>
              .
            </p>
          </div>
        ) : (
          <video
            className="h-full w-full bg-[#001F33] object-contain"
            controls
            playsInline
            preload="metadata"
            poster={POSTER_SRC}
            width={1920}
            height={1080}
            aria-label="Next Wave CRM demonstration video"
            aria-describedby="demo-note"
            onLoadedMetadata={() => setStatus('ready')}
            onError={() => setStatus('error')}
          >
            <source src={VIDEO_SRC} type="video/mp4" onError={() => setStatus('error')} />
          </video>
        )}
        {status === 'loading' && showLoading ? (
          <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#001F33]/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#7dd3f5]">
            Loading
          </p>
        ) : null}
      </div>
      <p id="demo-note" className="mt-4 text-base leading-7 text-slate-200">
        This demonstration uses a fictional customer. It illustrates the workflow and keeps its original voiceover. It is not a recording of a live customer system.
      </p>
      <p className="sr-only" role="status">
        {statusText}
      </p>
      <div className="mt-4">
        <a href="#packages" className="inline-flex min-h-11 items-center font-semibold text-[#7dd3f5] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7dd3f5]">
          Explore Our Booking & CRM Solutions
        </a>
      </div>
    </figure>
  );
}
