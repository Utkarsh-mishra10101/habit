// ============================================================
//  supabaseClient.js — HabitForge Supabase Initialization
//  ⚠️  Replace the two values below with your project's keys.
//  Find them at: https://supabase.com/dashboard → Settings → API
// ============================================================

const SUPABASE_URL  = 'https://ucpobdcqbzflutefoheh.supabase.co';
const SUPABASE_ANON = 'sb_publishable_JUPCtzl1G8aeA-BVWEAStQ_V6x7lMGl';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
