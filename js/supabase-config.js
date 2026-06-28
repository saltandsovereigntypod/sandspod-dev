/* =========================================================
   SUPABASE CONFIGURATION
   ========================================================= */

const SUPABASE_URL = "https://outksqvhusvvtjgiveoh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dGtzcXZodXN2dnRqZ2l2ZW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjU1NzIsImV4cCI6MjA5ODI0MTU3Mn0.DpNtUtQLcMbcsDvuxmuklW5IY3e78fEquD6IkRQHuYw";

/* Create our project client */
const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

console.log("✨ Supabase connected!");
