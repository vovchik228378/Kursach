import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Клиент создаётся всегда, чтобы приложение не падало на импорте, если
 * переменные окружения ещё не заданы. Признак настройки проверяет интерфейс
 * и показывает баннер вместо загадочных ошибок сети.
 */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
