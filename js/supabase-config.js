/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL = "PASTE YOUR PROJECT URL HERE";

const SUPABASE_ANON_KEY = "PASTE YOUR PUBLISHABLE KEY HERE";


const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("Supabase connected.");
