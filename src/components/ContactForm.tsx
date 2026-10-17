import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import {
  isServiceInterestId,
  serviceInterestLabel,
  serviceInterests,
  type ServiceInterestId,
} from '../data/offers';

interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  businessName: string;
  service: string;
  message: string;
}

const createHubSpotContact = async (contactData: ContactPayload) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('The contact form is not configured. Email joshua@nextwavedigitalsolution.com instead.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/create-hubspot-contact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactData),
  });

  let data: { success?: boolean; error?: string } | null = null;
  const text = await response.text();

  if (text) {
    try {
      data = JSON.parse(text) as { success?: boolean; error?: string };
    } catch {
      data = null;
    }
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || 'Failed to submit contact');
  }

  return data;
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  businessName: '',
  service: '' as ServiceInterestId | '',
  message: '',
};

type FormState = typeof emptyForm;
type FieldErrors = Partial<Record<keyof FormState, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[\d\s()+.-]{7,20}$/;

const validate = (formData: FormState): FieldErrors => {
  const errors: FieldErrors = {};
  const name = formData.name.trim();
  const email = formData.email.trim();
  const businessName = formData.businessName.trim();
  const message = formData.message.trim();
  const phone = formData.phone.trim();

  if (name.length < 2 || name.length > 120) {
    errors.name = 'Enter your name.';
  }

  if (!emailPattern.test(email) || email.length > 254) {
    errors.email = 'Enter a valid email address.';
  }

  if (businessName.length < 2 || businessName.length > 160) {
    errors.businessName = 'Enter your business name.';
  }

  if (phone && !phonePattern.test(phone)) {
    errors.phone = 'Enter a valid phone number, or leave this blank.';
  }

  if (!isServiceInterestId(formData.service)) {
    errors.service = 'Select a service.';
  }

  if (message.length < 10 || message.length > 5000) {
    errors.message = 'Add a few details about the project (at least 10 characters).';
  }

  return errors;
};

const fieldClass = (invalid: boolean) =>
  `w-full min-w-0 rounded-lg border bg-[#003B5C]/60 px-4 py-3 text-base text-white placeholder:text-slate-400 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3f5] ${
    invalid ? 'border-red-300' : 'border-[#2283B8]/40'
  }`;

export const ContactForm = () => {
  const [searchParams] = useSearchParams();
  const requestedService = searchParams.get('service');
  const [formData, setFormData] = useState<FormState>(() => ({
    ...emptyForm,
    service: isServiceInterestId(requestedService) ? requestedService : '',
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const requested = searchParams.get('service');
    if (isServiceInterestId(requested)) {
      setFormData((current) => ({ ...current, service: requested }));
      setErrors((current) => ({ ...current, service: undefined }));
    }
  }, [searchParams]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setIsSubmitted(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitted(false);

    const nextErrors = validate(formData);
    setErrors(nextErrors);

    const firstInvalid = (Object.keys(nextErrors) as Array<keyof FormState>).find((key) => nextErrors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    if (!isServiceInterestId(formData.service)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await createHubSpotContact({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        businessName: formData.businessName.trim(),
        service: serviceInterestLabel(formData.service),
        message: formData.message.trim(),
      });

      setIsSubmitted(true);
      setFormData((current) => ({
        ...emptyForm,
        service: current.service,
      }));
    } catch (err) {
      setIsSubmitted(false);
      setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative rounded-2xl border border-[#2283B8]/30 bg-[#001F33]/40 p-5 sm:p-8"
    >
      <p className="mb-6 text-sm text-slate-300">Required fields are marked.</p>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-100">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            value={formData.name}
            onChange={handleChange}
            className={fieldClass(Boolean(errors.name))}
          />
          {errors.name && (
            <p id="name-error" className="mt-2 text-sm text-red-200">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-100">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            value={formData.email}
            onChange={handleChange}
            className={fieldClass(Boolean(errors.email))}
          />
          {errors.email && (
            <p id="email-error" className="mt-2 text-sm text-red-200">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="businessName" className="mb-2 block text-sm font-medium text-slate-100">
            Business name <span aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            id="businessName"
            name="businessName"
            autoComplete="organization"
            required
            aria-invalid={Boolean(errors.businessName)}
            aria-describedby={errors.businessName ? 'businessName-error' : undefined}
            value={formData.businessName}
            onChange={handleChange}
            className={fieldClass(Boolean(errors.businessName))}
          />
          {errors.businessName && (
            <p id="businessName-error" className="mt-2 text-sm text-red-200">
              {errors.businessName}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-100">
            Phone <span className="font-normal text-slate-300">(optional)</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            value={formData.phone}
            onChange={handleChange}
            className={fieldClass(Boolean(errors.phone))}
          />
          {errors.phone && (
            <p id="phone-error" className="mt-2 text-sm text-red-200">
              {errors.phone}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="service" className="mb-2 block text-sm font-medium text-slate-100">
          Service interest <span aria-hidden="true">*</span>
        </label>
        <select
          id="service"
          name="service"
          required
          aria-invalid={Boolean(errors.service)}
          aria-describedby={errors.service ? 'service-error' : undefined}
          value={formData.service}
          onChange={handleChange}
          className={fieldClass(Boolean(errors.service))}
        >
          <option value="">Select a service</option>
          {serviceInterests.map((item) => (
            <option key={item.id} value={item.id} className="bg-[#003B5C] text-white">
              {item.label}
            </option>
          ))}
        </select>
        {errors.service && (
          <p id="service-error" className="mt-2 text-sm text-red-200">
            {errors.service}
          </p>
        )}
      </div>

      <div className="mb-6">
        <label htmlFor="message" className="mb-2 block text-sm font-medium text-slate-100">
          Project details <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'message-error' : undefined}
          value={formData.message}
          onChange={handleChange}
          className={`${fieldClass(Boolean(errors.message))} resize-y`}
          placeholder="How do customers book with you today, and what should the setup handle?"
        />
        {errors.message && (
          <p id="message-error" className="mt-2 text-sm text-red-200">
            {errors.message}
          </p>
        )}
      </div>

      <div aria-live="polite" className="mb-4">
        {error && (
          <p className="rounded-lg border border-red-300/40 bg-red-950/40 p-4 text-sm text-red-100" role="alert">
            {error}
          </p>
        )}
        {isSubmitted && (
          <p className="rounded-lg border border-emerald-300/40 bg-emerald-950/40 p-4 text-sm text-emerald-100" role="status">
            Your message was sent. We will reply to the email address you provided.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#2283B8] px-8 py-4 text-base font-semibold text-white hover:bg-[#1b6d99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          'Sending...'
        ) : (
          <>
            <span>Send Message</span>
            <Send size={18} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
};
