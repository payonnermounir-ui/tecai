import { createClient } from "@supabase/supabase-js";

const const supabaseUrl = 'https://jfkgagorghxael.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impma2Fnb3JnbGh4YWVoemdyYXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTA2MTUsImV4cCI6MjA5MTIyNjYxNX0.IqN5LRyRrYoDepRqoNzF7G64qSOIsbxFZXszCHhtAJ8';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // لا يحتفظ بتسجيل الدخول بعد تحديث الصفحة
      },
    })
  : null;
