import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: {
        getItem: (key) => {
          if (typeof window === 'undefined') return null;
          // ⭐ PRVO ČITAJ IZ COOKIE ⭐
          const cookie = document.cookie.split('; ').find(row => row.startsWith(key + '='));
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
        },
        setItem: (key, value) => {
          if (typeof window === 'undefined') return;
          // ⭐ ČUVAJ U COOKIE (ne u localStorage) ⭐
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=604800; Secure; SameSite=Lax`;
        },
        removeItem: (key) => {
          if (typeof window === 'undefined') return;
          document.cookie = `${key}=; path=/; max-age=0; Secure; SameSite=Lax`;
        },
      },
    },
  }
);