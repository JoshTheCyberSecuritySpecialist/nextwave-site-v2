export const PLATFORM_ADMIN_EMAIL = 'joshua@nextwavedigitalsolution.com';

export function isPlatformAdmin(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
