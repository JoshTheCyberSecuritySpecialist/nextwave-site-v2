export function ProductDemo() {
  return (
    <div id="demo" className="w-full min-w-0 max-w-[960px] scroll-mt-28">
      <video
        className="aspect-video w-full rounded-2xl bg-[#001F33]"
        controls
        playsInline
        preload="metadata"
        poster="/videos/nextwave-crm-demo-poster.jpg"
        width={1920}
        height={1080}
        aria-describedby="demo-note"
      >
        <source src="/videos/nextwave-crm-demo.mp4" type="video/mp4" />
        <p className="mt-4 text-base leading-7 text-slate-200">
          The demonstration could not be loaded. Compare the booking and website packages below, or <a className="text-[#7dd3f5] underline" href="/videos/nextwave-crm-demo.mp4">open the video file</a>.
        </p>
      </video>
      <p id="demo-note" className="mt-4 text-base leading-7 text-slate-200">
        This demonstration uses a fictional customer. It illustrates the workflow and keeps its original voiceover. It is not a recording of a live customer system.
      </p>
      <div className="mt-4">
        <a href="#packages" className="inline-flex min-h-11 items-center font-semibold text-[#7dd3f5] underline-offset-4 hover:underline">
          Explore Our Booking & CRM Solutions
        </a>
      </div>
    </div>
  );
};
