import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client only if credentials are available
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!supabase;
};

// Get Supabase URL for direct function calls (fallback)
export const getSupabaseUrl = (): string | null => {
  return supabaseUrl || null;
};
