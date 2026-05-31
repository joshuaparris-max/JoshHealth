import { createClient } from '@supabase/supabase-js'

const viteEnv = import.meta.env || {}
const nodeEnv = typeof process !== 'undefined' ? process.env : {}

const supabaseUrl = viteEnv.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || nodeEnv.SUPABASE_URL
const supabaseAnonKey =
  viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  viteEnv.VITE_SUPABASE_ANON_KEY ||
  nodeEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  nodeEnv.VITE_SUPABASE_ANON_KEY

if ((!supabaseUrl || !supabaseAnonKey) && typeof window !== 'undefined') {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY not set — Supabase client will be disabled in browser')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export default supabase
