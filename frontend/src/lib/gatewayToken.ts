import type { Session } from '@supabase/supabase-js';

/** JWT Supabase (auth app RPS), miroir pour fetch — vérifié gateway via SUPABASE_JWT_SECRET. Voir docs/authentification.md */
export const GATEWAY_TOKEN_KEY = 'amipeq_token';

export function setGatewayTokenFromSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  if (session?.access_token) {
    localStorage.setItem(GATEWAY_TOKEN_KEY, session.access_token);
  } else {
    localStorage.removeItem(GATEWAY_TOKEN_KEY);
  }
}
