const steps = [
  {
    title: 'Inquiry',
    lines: ['Jordan Hale', 'Asked about a weekday consultation'],
  },
  {
    title: 'Customer record',
    lines: ['jordan@northshore.example', 'Tag: New inquiry', 'Note: Prefers morning appointments'],
  },
  {
    title: 'Appointment',
    lines: ['Tue, Apr 14 · 10:00 AM', 'Consultation · 45 minutes', 'Status: Scheduled'],
  },
  {
    title: 'Email conversation',
    lines: [
      'From: studio@harborlane.example',
      '“Your Tuesday consultation is confirmed.”',
      'Reply received from Jordan',
    ],
  },
  {
    title: 'Follow-up',
    lines: ['Task: Check in after the consultation', 'Due: Wed, Apr 15'],
  },
];

export const WorkflowIllustration = () => {
  return (
    <figure className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#2283B8]/40 bg-[#001F33]/70">
      <figcaption className="flex flex-col gap-1 border-b border-[#2283B8]/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <span className="text-base font-semibold text-white">Example workflow</span>
        <span className="text-sm text-slate-300">Fictional sample. Not a live system.</span>
      </figcaption>

      <ol className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="min-w-0 rounded-xl border border-[#2283B8]/25 bg-[#003B5C]/70 p-4"
          >
            <p className="mb-2 text-sm font-semibold tracking-wide text-[#7dd3f5]">
              {index + 1}. {step.title}
            </p>
            <div className="space-y-1">
              {step.lines.map((line) => (
                <p key={line} className="break-words text-sm leading-5 text-slate-100">
                  {line}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
};
