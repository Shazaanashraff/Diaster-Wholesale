import { createClient } from '@supabase/supabase-js';
import { captureFetch } from '../services/captureFetch';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const schema = import.meta.env.VITE_SUPABASE_SCHEMA || 'public';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema },
  global: {
    fetch: (input, init) => captureFetch(input, init),
  },
});
