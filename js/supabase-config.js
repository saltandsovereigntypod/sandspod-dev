/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL = "https://aiiqyesczxrrujznwoke.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_QWf1B9BxGQkeFQsuJ4Mn3w_NvXytwVg";

/* Create our project client */
const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("✨ Supabase connected!");
