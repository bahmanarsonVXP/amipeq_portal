import type { Session } from '@supabase/supabase-js';

/** Clé alignée sur `api.ts` : JWT envoyé au gateway (vérifié avec SUPABASE_JWT_SECRET). */
export const GATEWAY_TOKEN_KEY = 'amipeq_token';

export function setGatewayTokenFromSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  if (session?.access_token) {
    localStorage.setItem(GATEWAY_TOKEN_KEY, session.access_token);
  } else {
    localStorage.removeItem(GATEWAY_TOKEN_KEY);
  }
}
