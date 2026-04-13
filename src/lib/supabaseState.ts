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
  login_password?: string;
  payment_password?: string | null;
};

type WalletRow = {
  phone: string;
  balance: number;
};

type ChannelRow = {
  id: string;
  phone: string;
  provider: string;
  holder_name: string;
  channel_phone: string;
  account_number: string;
};

type ReferralMap = Record<string, string>;

async function detectSchemaMode() {
  if (!isSupabaseConfigured || !supabase) return "legacy" as const;
  if (schemaMode !== "unknown") return schemaMode;

  const { error } = await supabase.from("profiles").select("phone").limit(1);
  schemaMode = error ? "legacy" : "normalized";
  return schemaMode;
}

async function safeSelect(table: string, columns = "*") {
  if (!supabase) return { data: null, error: new Error("supabase_not_configured") };
  return supabase.from(table).select(columns);
}

async function safeSelectOrdered(table: string, orderColumn: string) {
  if (!supabase) return { data: null, error: new Error("supabase_not_configured") };

  const col = String(orderColumn ?? "").trim();
  if (!col) {
    return supabase.from(table).select("*");
  }

  const ordered = await supabase
    .from(table)
    .select("*")
    .order(col, { ascending: false });

  if (!ordered.error) return ordered;

  return supabase.from(table).select("*");
}

async function loadProfilesWithFallback() {
  if (!supabase) return { data: null, error: new Error("supabase_not_configured") };

  const full = await supabase
    .from("profiles")
    .select("phone, login_password, payment_password");

  if (!full.error) return full;

  const phoneOnly = await supabase.from("profiles").select("phone");
  if (phoneOnly.error) return full;

  return {
    data: (phoneOnly.data ?? []).map((row) => ({
      phone: String((row as { phone?: string }).phone ?? ""),
      login_password: "",
      payment_password: null,
    })),
    error: null,
  };
}

async function loadNormalizedState(): Promise<PersistedAppState | null> {
  if (!supabase) return null;

  const [metaRes, profilesRes, walletsRes, channelsRes, txsRes, devicesRes, profitsRes] = await Promise.all([
    safeSelect("app_meta", "key, value"),
    loadProfilesWithFallback(),
    safeSelect("wallets", "phone, balance"),
    safeSelect("withdrawal_channels", "id, phone, provider, holder_name, channel_phone, account_number"),
    safeSelectOrdered("transactions", "created_at"),
    safeSelectOrdered("devices", "purchased_at"),
    safeSelectOrdered("profit_records", "created_at"),
  ]);

  // app_meta قد يفشل بسبب RLS، لا نكسر التطبيق بسببه
  const hardErrors = [profilesRes.error, walletsRes.error, channelsRes.error, txsRes.error, devicesRes.error, profitsRes.error].filter(Boolean);
  if (hardErrors.length > 0) throw hardErrors[0];

  const metaMap = new Map<string, unknown>();
  if (!metaRes.error) {
    for (const row of metaRes.data ?? []) {
      const item = row as { key: string; value: unknown };
      metaMap.set(item.key, item.value);
    }
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

  const referrals = (metaMap.get("referrals") as ReferralMap | undefined) ?? {};
  const accounts: Record<string, unknown> = {};

  for (const row of (profilesRes.data ?? []) as ProfileRow[]) {
    accounts[row.phone] = {
      loginPassword: row.login_password ?? "",
      paymentPassword: row.payment_password ?? undefined,
      channels: channelsByPhone.get(row.phone) ?? [],
      referredBy: referrals[row.phone],
    };
  }

  const balances: Record<string, number> = {};
  for (const row of (walletsRes.data ?? []) as WalletRow[]) {
    balances[row.phone] = Number(row.balance ?? 0);
  }

  const txs = (txsRes.data ?? []).map((row: any) => ({
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

  const devices = (devicesRes.data ?? []).map((row: any) => ({
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

  const profitRecords = (profitsRes.data ?? []).map((row: any) => ({
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
    metaMap.has("lang");

  if (!hasAnyData) return null;

  return {
    lang: (metaMap.get("lang") as PersistedAppState["lang"]) ?? "ar",
    session: null,
    accounts,
    balances,
    txs,
    devices,
    profitRecords,
  };
}

async function saveNormalizedState(payload: PersistedAppState) {
  if (!supabase) return;
  const nowIso = new Date().toISOString();

  const accountEntries = Object.entries(payload.accounts ?? {});

  const profiles = accountEntries.map(([phone, account]) => {
    const data = (account as { loginPassword?: string; paymentPassword?: string }) ?? {};
    return {
      phone,
      login_password: data.loginPassword ?? "",
      payment_password: data.paymentPassword ?? null,
      updated_at: nowIso,
    };
  });

  const wallets = Object.entries(payload.balances ?? {}).map(([phone, balance]) => ({
    phone,
    balance: Number(balance ?? 0),
    updated_at: nowIso,
  }));

  const channels = accountEntries.flatMap(([phone, account]) => {
    const data = (account as { channels?: Array<{ id: string; provider: string; holderName: string; phone: string; accountNumber: string }> }) ?? {};
    return (data.channels ?? []).map((ch) => ({
      id: ch.id,
      phone,
      provider: ch.provider || "Bank",
      holder_name: ch.holderName || "",
      channel_phone: ch.phone || "",
      account_number: ch.accountNumber || "",
      created_at: nowIso,
    }));
  });

  const txs = (payload.txs ?? []).map((tx) => {
    const row = tx as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      phone: String(row.phone ?? ""),
      type: row.type === "withdraw" ? "withdraw" : "deposit",
      amount: Number(row.amount ?? 0),
      method: String(row.method ?? ""),
      status: row.status === "approved" || row.status === "rejected" ? row.status : "pending",
      payout_details: String(row.payoutDetails ?? ""),
      receipt_name: String(row.receiptName ?? ""),
      receipt_data_url: String(row.receiptDataUrl ?? ""),
      created_at: String(row.createdAt ?? nowIso),
    };
  });

  const devices = (payload.devices ?? []).map((device) => {
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
      purchased_at: String(row.purchasedAt ?? nowIso),
      earned_amount: Number(row.earnedAmount ?? 0),
      hourly_rate: Number(row.hourlyRate ?? 0),
      last_payout_at: row.lastPayoutAt ? String(row.lastPayoutAt) : null,
    };
  });

  const profits = (payload.profitRecords ?? []).map((profit) => {
    const row = profit as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      phone: String(row.phone ?? ""),
      device_id: String(row.deviceId ?? ""),
      amount: Number(row.amount ?? 0),
      cycles: Number(row.cycles ?? 0),
      created_at: String(row.createdAt ?? nowIso),
    };
  });

  // upsert الأساسية
  await supabase.from("profiles").upsert(profiles, { onConflict: "phone" });
  await supabase.from("wallets").upsert(wallets, { onConflict: "phone" });
  await supabase.from("withdrawal_channels").upsert(channels, { onConflict: "id" });
  await supabase.from("transactions").upsert(txs, { onConflict: "id" });
  await supabase.from("devices").upsert(devices, { onConflict: "id" });
  await supabase.from("profit_records").upsert(profits, { onConflict: "id" });

  // app_meta اختياري: إذا RLS يمنع، لا نرمي خطأ
  const referrals: ReferralMap = {};
  for (const [phone, account] of accountEntries) {
    const referredBy = String((account as { referredBy?: string })?.referredBy ?? "").trim();
    if (referredBy) referrals[phone] = referredBy;
  }

  const { error: metaError } = await supabase.from("app_meta").upsert(
    [
      { key: "lang", value: payload.lang, updated_at: nowIso },
      { key: "referrals", value: referrals, updated_at: nowIso },
    ],
    { onConflict: "key" },
  );

  if (metaError) {
    console.warn("[supabase] app_meta skipped:", metaError.message);
  }
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

  if (error) throw error;
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
    { id: APP_STATE_ID, payload, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );

  if (error) throw error;
}
