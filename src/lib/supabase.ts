import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Sanitize environment variables by stripping newlines, carriage returns, quotes, and whitespace
const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const cleanUrl = String(rawUrl).trim().replace(/[\r\n\t]/g, '').replace(/^["']|["']$/g, '');
const cleanKey = String(rawKey).trim().replace(/[\r\n\t]/g, '').replace(/^["']|["']$/g, '');

function isValidSupabaseUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !/\s/.test(url);
  } catch {
    return false;
  }
}

function isValidSupabaseKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return key.length > 20 && !/\s/.test(key) && !key.includes('your-anon-key');
}

export const isSupabaseConfigured = Boolean(
  isValidSupabaseUrl(cleanUrl) && isValidSupabaseKey(cleanKey)
);

// Safely instantiate client with try/catch fallback
let client: SupabaseClient | null = null;
if (isSupabaseConfigured) {
  try {
    client = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase] Client initialization failed, falling back to local guest storage:', err);
    client = null;
  }
}

export const supabase = client;
