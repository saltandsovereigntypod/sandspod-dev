/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

if (!window.SaltEnvironment) throw new Error("Load js/environment.js before js/supabase-config.js.");

// Both projects are selected by the shared environment module so merges never
// require hand-editing this file. Public browser keys are environment-specific;
// privileged/service-role keys must never be included in frontend source.
const saltSupabaseConfig = window.SaltEnvironment.getSupabaseConfig();
const db = window.supabase.createClient(saltSupabaseConfig.url, saltSupabaseConfig.publishableKey);
window.db = db;
