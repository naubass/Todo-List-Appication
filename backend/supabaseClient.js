// backend/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Pastikan dotenv terbaca di file client langsung
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️ Environment variable SUPABASE_URL atau SUPABASE_KEY belum terpasang!');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,     // MATIKAN session caching di memory serverless
    autoRefreshToken: false,   // Backend tidak perlu auto-refresh token
    detectSessionInUrl: false,
  },
});