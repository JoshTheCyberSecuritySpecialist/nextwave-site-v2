import { bookingPackage, websiteCrmPackage } from '../data/offers';

const ctaClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2283B8] px-6 py-3 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function ProductDemo() {
  return (
    <section id="demo" aria-labelledby="demo-heading" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h2 id="demo-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See How Next Wave Can Transform Your Business
          </h2>
          <p id="demo-note" className="mt-4 text-lg leading-8 text-slate-200">
            See how an enquiry, a booking, preparation, the appointment, and follow-up can stay connected.
            This demonstration uses a fictional customer. It illustrates the workflow and keeps its original voiceover. It is not a recording of a live customer system.
          </p>
        </div>
        <video
          className="mt-8 aspect-video w-full rounded-2xl bg-[#001F33]"
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
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          The {websiteCrmPackage.priceDisplay} package includes the website, booking, and CRM. Follow-up stays in your hands. This is not automated marketing, bulk messaging, or automatic replies.
          The {bookingPackage.priceDisplay} booking package does not include the website or full CRM.
        </p>
        <a href="#packages" className={`mt-6 ${ctaClass}`}>
          Explore Our Booking & CRM Solutions
        </a>
      </div>
    </section>
  );
}
