export type PersistedAppState = {
  lang: "ar" | "en" | "zh";
  session: { role: "user" | "admin"; phone: string } | null;
  accounts: Record<string, unknown>;
  balances: Record<string, number>;
  txs: unknown[];
  devices: unknown[];
  profitRecords: unknown[];
};

// تعطيل التحميل من Supabase مؤقتا
export async function loadSupabaseState(): Promise<PersistedAppState | null> {
  return null;
}

// تعطيل الحفظ إلى Supabase مؤقتا
export async function saveSupabaseState(_payload: PersistedAppState): Promise<void> {
  return;
}
