import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { useState, FormEvent } from 'react';

const createHubSpotContact = async (contactData: {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  service?: string;
  message: string;
}) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/create-hubspot-contact`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit contact');
  }

  return response.json();
};

export const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
    service: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await createHubSpotContact(formData);

      setIsSubmitting(false);
      setIsSubmitted(true);

      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          businessName: '',
          service: '',
          message: '',
        });
      }, 3000);
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      onSubmit={handleSubmit}
      className="relative p-8 bg-[#001F33]/40 backdrop-blur-sm border border-[#2283B8]/30 rounded-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors"
            placeholder="john@example.com"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors"
            placeholder="(321) 555-0123"
          />
        </div>

        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-gray-300 mb-2">
            Business Name
          </label>
          <input
            type="text"
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors"
            placeholder="Your Company"
          />
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="service" className="block text-sm font-medium text-gray-300 mb-2">
          Service Needed *
        </label>
        <select
          id="service"
          name="service"
          required
          value={formData.service}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors"
        >
          <option value="">Select a service</option>
          <option value="web-development">Web Development</option>
          <option value="cybersecurity">Cybersecurity & IT</option>
          <option value="automation-ai">Automation & AI</option>
          <option value="local-it-support">Local IT Support</option>
          <option value="consulting">Consulting</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
          Message *
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          value={formData.message}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-[#003B5C]/50 border border-[#2283B8]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#2BB0E8] focus:ring-1 focus:ring-[#2BB0E8] transition-colors resize-none"
          placeholder="Tell us about your project..."
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {isSubmitted && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 text-sm">
          Your information has been submitted!
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={isSubmitting || isSubmitted}
        className="w-full flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-[#2283B8] to-[#2BB0E8] text-white rounded-lg font-semibold hover:shadow-xl hover:shadow-[#2283B8]/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span>Sending...</span>
        ) : isSubmitted ? (
          <span>Message Sent!</span>
        ) : (
          <>
            <span>Send Message</span>
            <Send size={20} />
          </>
        )}
      </motion.button>
    </motion.form>
  );
};
