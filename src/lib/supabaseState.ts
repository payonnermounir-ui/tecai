import { isSupabaseConfigured, supabase } from "./supabase";

const APP_STATE_ID = "main";
let schemaMode: "unknown" | "normalized" | "legacy" = "unknown";

export type PersistedAppState = {
  lang: "ar" | "en" | "zh";
  session: { role: "user" | "admin"; phone: string } | null;
  accounts: Record<string, unknown>;
  balances: Record<string, number>;
  txs: unknown[];
  devices: unknown[];
  profitRecords: unknown[];
};

type ProfileRow = {
  phone: string;
  login_password: string;
  payment_password: string | null;
  created_at: string;
  updated_at: string;
};

type ReferralMap = Record<string, string>;

type WalletRow = {
  phone: string;
  balance: number;
  updated_at: string;
};

type ChannelRow = {
  id: string;
  phone: string;
  provider: string;
  holder_name: string;
  channel_phone: string;
  account_number: string;
  created_at: string;
};

async function detectSchemaMode() {
  if (!isSupabaseConfigured || !supabase) return "legacy" as const;
  if (schemaMode !== "unknown") return schemaMode;

  const { error } = await supabase.from("profiles").select("phone").limit(1);
  schemaMode = error ? "legacy" : "normalized";
  return schemaMode;
}

async function loadNormalizedState(): Promise<PersistedAppState | null> {
  if (!supabase) return null;

  const [metaRes, profilesRes, walletsRes, channelsRes, txsRes, devicesRes, profitsRes] = await Promise.all([
    supabase.from("app_meta").select("key, value"),
    supabase.from("profiles").select("phone, login_password, payment_password, created_at, updated_at"),
    supabase.from("wallets").select("phone, balance, updated_at"),
    supabase.from("withdrawal_channels").select("id, phone, provider, holder_name, channel_phone, account_number, created_at"),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("devices").select("*").order("purchased_at", { ascending: false }),
    supabase.from("profit_records").select("*").order("created_at", { ascending: false }),
  ]);

  const errors = [metaRes.error, profilesRes.error, walletsRes.error, channelsRes.error, txsRes.error, devicesRes.error, profitsRes.error].filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  const metaMap = new Map<string, unknown>();
  for (const row of metaRes.data ?? []) {
    metaMap.set(row.key as string, row.value);
  }

  const channelsByPhone = new Map<string, Array<Record<string, unknown>>>();
  for (const row of (channelsRes.data ?? []) as ChannelRow[]) {
    const list = channelsByPhone.get(row.phone) ?? [];
    list.push({
      id: row.id,
      provider: row.provider,
      holderName: row.holder_name,
      phone: row.channel_phone,
      accountNumber: row.account_number,
    });
    channelsByPhone.set(row.phone, list);
  }

  const referralMap = (metaMap.get("referrals") as ReferralMap | undefined) ?? {};
  const accounts: Record<string, unknown> = {};
  for (const row of (profilesRes.data ?? []) as ProfileRow[]) {
    accounts[row.phone] = {
      loginPassword: row.login_password,
      paymentPassword: row.payment_password ?? undefined,
      channels: channelsByPhone.get(row.phone) ?? [],
      referredBy: referralMap[row.phone],
    };
  }

  const balances: Record<string, number> = {};
  for (const row of (walletsRes.data ?? []) as WalletRow[]) {
    balances[row.phone] = Number(row.balance ?? 0);
  }

  const txs = (txsRes.data ?? []).map((row) => ({
    id: row.id,
    phone: row.phone,
    type: row.type,
    amount: Number(row.amount ?? 0),
    method: row.method,
    status: row.status,
    payoutDetails: row.payout_details ?? undefined,
    receiptName: row.receipt_name ?? undefined,
    receiptDataUrl: row.receipt_data_url ?? undefined,
    createdAt: row.created_at,
  }));

  const devices = (devicesRes.data ?? []).map((row) => ({
    id: row.id,
    phone: row.phone,
    planCode: row.plan_code,
    planPrice: Number(row.plan_price ?? 0),
    dailyIncome: Number(row.daily_income ?? 0),
    totalIncome: Number(row.total_income ?? 0),
    validityDays: Number(row.validity_days ?? 0),
    image: row.image,
    purchasedAt: row.purchased_at,
    earnedAmount: Number(row.earned_amount ?? 0),
    hourlyRate: Number(row.hourly_rate ?? 0),
    lastPayoutAt: row.last_payout_at ?? undefined,
  }));

  const profitRecords = (profitsRes.data ?? []).map((row) => ({
    id: row.id,
    phone: row.phone,
    deviceId: row.device_id,
    amount: Number(row.amount ?? 0),
    cycles: Number(row.cycles ?? 0),
    createdAt: row.created_at,
  }));

  const hasAnyData =
    (profilesRes.data?.length ?? 0) > 0 ||
    (walletsRes.data?.length ?? 0) > 0 ||
    (channelsRes.data?.length ?? 0) > 0 ||
    (txsRes.data?.length ?? 0) > 0 ||
    (devicesRes.data?.length ?? 0) > 0 ||
    (profitsRes.data?.length ?? 0) > 0 ||
    metaMap.has("lang") ||
    metaMap.has("session");

  if (!hasAnyData) return null;

  return {
    lang: (metaMap.get("lang") as PersistedAppState["lang"]) ?? "ar",
    session: (metaMap.get("session") as PersistedAppState["session"]) ?? null,
    accounts,
    balances,
    txs,
    devices,
    profitRecords,
  };
}

async function saveNormalizedState(payload: PersistedAppState) {
  if (!supabase) return;
  const client = supabase;

  const nowIso = new Date().toISOString();
  const accountEntries = Object.entries(payload.accounts ?? {});

  const uniqueBy = <T extends Record<string, unknown>>(items: T[], key: keyof T) => {
    const map = new Map<string, T>();
    for (const item of items) {
      const id = String(item[key] ?? "").trim();
      if (!id) continue;
      // Keep the first item when duplicated IDs exist.
      if (!map.has(id)) {
        map.set(id, item);
      }
    }
    return Array.from(map.values());
  };

  const upsertRows = async (table: string, rows: Record<string, unknown>[], onConflict: string) => {
    if (rows.length === 0) return;

    const { error } = await client.from(table).upsert(rows, { onConflict });
    if (!error) return;

    // Fallback to row-by-row sync so one bad row does not block all writes.
    for (const row of rows) {
      const { error: rowError } = await client.from(table).upsert(row, { onConflict });
      if (rowError) {
        console.warn(`[supabase] failed to upsert row in ${table}`, rowError.message);
      }
    }
  };

  const safeIso = (value: unknown, fallback: string) => {
    const text = String(value ?? "").trim();
    if (!text) return fallback;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
  };

  const profiles = uniqueBy(accountEntries.map(([phone, account]) => {
    const data = (account as { loginPassword?: string; paymentPassword?: string }) ?? {};
    return {
      phone,
      login_password: data.loginPassword ?? "",
      payment_password: data.paymentPassword ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    };
  }), "phone");

  const referrals: ReferralMap = {};
  for (const [phone, account] of accountEntries) {
    const referredBy = String((account as { referredBy?: string })?.referredBy ?? "").trim();
    if (referredBy) {
      referrals[phone] = referredBy;
    }
  }

  const wallets = uniqueBy(Object.entries(payload.balances ?? {}).map(([phone, balance]) => ({
    phone,
    balance: Number.isFinite(Number(balance)) ? Number(balance) : 0,
    updated_at: nowIso,
  })), "phone");

  const channels = uniqueBy(accountEntries.flatMap(([phone, account]) => {
    const data = (account as { channels?: Array<{ id: string; provider: string; holderName: string; phone: string; accountNumber: string }> }) ?? {};
    return (data.channels ?? []).map((channel) => ({
      id: channel.id,
      phone,
      provider: channel.provider || "Bank",
      holder_name: channel.holderName || "",
      channel_phone: channel.phone || "",
      account_number: channel.accountNumber || "",
      created_at: nowIso,
    }));
  }), "id").filter((row) => String(row.phone ?? "").trim().length > 0);

  const txs = uniqueBy((payload.txs ?? []).map((tx) => {
    const row = tx as Record<string, unknown>;
    const type = row.type === "withdraw" ? "withdraw" : "deposit";
    const status = row.status === "approved" || row.status === "rejected" ? row.status : "pending";
    const method = String(row.method ?? (type === "deposit" ? "TRC20" : "Bank")).trim() || (type === "deposit" ? "TRC20" : "Bank");
    return {
      id: String(row.id ?? ""),
      phone: String(row.phone ?? ""),
      type,
      amount: Number(row.amount ?? 0),
      method,
      status,
      payout_details: String((row.payoutDetails as string | undefined) ?? ""),
      receipt_name: String((row.receiptName as string | undefined) ?? ""),
      receipt_data_url: String((row.receiptDataUrl as string | undefined) ?? ""),
      created_at: safeIso(row.createdAt, nowIso),
    };
  }), "id").filter((row) => row.phone.trim() && Number.isFinite(row.amount));

  const devices = uniqueBy((payload.devices ?? []).map((device) => {
    const row = device as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      phone: String(row.phone ?? ""),
      plan_code: String(row.planCode ?? "A1"),
      plan_price: Number(row.planPrice ?? 0),
      daily_income: Number(row.dailyIncome ?? 0),
      total_income: Number(row.totalIncome ?? 0),
      validity_days: Number(row.validityDays ?? 0),
      image: String(row.image ?? "/images/robot-30.png"),
      purchased_at: safeIso(row.purchasedAt, nowIso),
      earned_amount: Number(row.earnedAmount ?? 0),
      hourly_rate: Number(row.hourlyRate ?? 0),
      last_payout_at: row.lastPayoutAt ? safeIso(row.lastPayoutAt, nowIso) : null,
    };
  }), "id").filter((row) => row.phone.trim());

  const profits = uniqueBy((payload.profitRecords ?? []).map((profit) => {
    const row = profit as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      phone: String(row.phone ?? ""),
      device_id: String(row.deviceId ?? ""),
      amount: Number(row.amount ?? 0),
      cycles: Number(row.cycles ?? 0),
      created_at: safeIso(row.createdAt, nowIso),
    };
  }), "id").filter((row) => row.phone.trim() && row.device_id.trim());

  await upsertRows("profiles", profiles, "phone");
  await upsertRows("wallets", wallets, "phone");
  await upsertRows("withdrawal_channels", channels, "id");
  await upsertRows("transactions", txs, "id");
  await upsertRows("devices", devices, "id");
  await upsertRows("profit_records", profits, "id");

  const { error: metaError } = await client.from("app_meta").upsert(
    [
      { key: "lang", value: payload.lang, updated_at: nowIso },
      { key: "session", value: payload.session, updated_at: nowIso },
      { key: "referrals", value: referrals, updated_at: nowIso },
    ],
    { onConflict: "key" },
  );
  if (metaError) throw metaError;
}

export async function loadSupabaseState() {
  if (!isSupabaseConfigured || !supabase) return null;

  const mode = await detectSchemaMode();
  if (mode === "normalized") {
    const normalized = await loadNormalizedState();
    if (normalized) return normalized;
  }

  const { data, error } = await supabase
    .from("app_state")
    .select("payload")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.payload) return null;
  return data.payload as PersistedAppState;
}

export async function saveSupabaseState(payload: PersistedAppState) {
  if (!isSupabaseConfigured || !supabase) return;

  const mode = await detectSchemaMode();
  if (mode === "normalized") {
    await saveNormalizedState(payload);
    return;
  }

  const { error } = await supabase.from("app_state").upsert(
    {
      id: APP_STATE_ID,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}
