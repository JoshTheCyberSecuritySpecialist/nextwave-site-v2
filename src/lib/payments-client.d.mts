export const RENDER_API_ORIGIN: string;
export function resolveApiBase(env?: { dev?: boolean; configured?: string }): string;
export function apiUrl(path: string, env?: { dev?: boolean; configured?: string }): string;
export function checkoutAvailability(env?: { dev?: boolean; configured?: string }): 'test' | 'disabled' | 'live-blocked';
