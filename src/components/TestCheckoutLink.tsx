import { Link } from 'react-router-dom';
import { checkoutAvailability, checkoutPath } from '../lib/payments-client.mjs';

const availability = checkoutAvailability({ dev: import.meta.env.DEV, configured: import.meta.env.VITE_CHECKOUT_MODE });

export function TestCheckoutLink({ packageId, className }: { packageId: 'booking-only' | 'website-crm'; className: string }) {
  if (availability !== 'test') return null;
  return <Link to={checkoutPath(packageId)} className={className}>Continue to test checkout</Link>;
}
