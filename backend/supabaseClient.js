import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseInstance = null;

export function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(`Supabase URL/Key missing. URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
    }

    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseInstance;
}

// Proxy agar sintaks `supabase.from(...)` di file index.js tetap bekerja tanpa perlu refactor
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase();
    return client[prop];
  }
});