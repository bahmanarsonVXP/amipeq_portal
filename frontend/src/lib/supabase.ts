/**
 * Client Supabase Auth — projet partagé avec l'application RPS.
 * Le portail n'a pas d'identité propre : voir docs/authentification.md
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  );
}

export const supabase = createClient();
