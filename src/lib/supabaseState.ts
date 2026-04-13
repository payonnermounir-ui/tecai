import { isSupabaseConfigured, supabase } from "./supabase";

const APP_STATE_ID = "main";

export type PersistedAppState = {
  lang: "ar" | "en" | "zh";
  session: { role: "user" | "admin"; phone: string } | null;
  accounts: Record<string, unknown>;
  balances: Record<string, number>;
  txs: unknown[];
  devices: unknown[];
  profitRecords: unknown[];
};

export async function loadSupabaseState(): Promise<PersistedAppState | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("app_state")
    .select("payload")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return null;

  return data.payload as PersistedAppState;
}

export async function saveSupabaseState(payload: PersistedAppState): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.from("app_state").upsert(
    {
      id: APP_STATE_ID,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw error;
}
