import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'aiiqyesczxrrujznwoke';
const PUBLISHABLE_KEY = 'sb_publishable_QWf1B9BxGQkeFQsuJ4Mn3w_NvXytwVg';

export const supabase = createClient(`https://${PROJECT_REF}.supabase.co`, PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
