import { isSupabaseConfigured, supabase } from "./supabase";

type TxType = "deposit" | "withdraw";
type TxStatus = "pending" | "approved" | "rejected";

export async function getUserByEmail(email: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function createUser(email: string, passwordHash: string, referredBy?: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("users")
      .insert({ email, password_hash: passwordHash, referred_by: referredBy })
      .select()
      .single();
    if (error) {
      // Fallback for schemas that do not include password_hash.
      const fallbackWithoutHash = await supabase
        .from("users")
        .insert({ email, referred_by: referredBy })
        .select()
        .single();
      if (!fallbackWithoutHash.error) return fallbackWithoutHash.data;

      // Fallback for schemas that do not include referred_by.
      const fallback = await supabase
        .from("users")
        .insert({ email, password_hash: passwordHash })
        .select()
        .single();
      if (!fallback.error) return fallback.data;

      // Last fallback for minimal users schema.
      const fallbackMinimal = await supabase
        .from("users")
        .insert({ email })
        .select()
        .single();
      if (fallbackMinimal.error) return null;
      return fallbackMinimal.data;
    }
    return data;
  } catch {
    return null;
  }
}

export async function getBalance(email: string) {
  if (!isSupabaseConfigured || !supabase) return { balance: 0, total_deposit: 0 };
  try {
    const { data, error } = await supabase
      .from("balances")
      .select("*")
      .eq("email", email)
      .single();
    if (error) {
      await createBalance(email);
      return { balance: 0, total_deposit: 0 };
    }
    return data;
  } catch {
    return { balance: 0, total_deposit: 0 };
  }
}

export async function createBalance(email: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    await supabase.from("balances").insert({ email, balance: 0, total_deposit: 0 });
    return { balance: 0, total_deposit: 0 };
  } catch {
    return null;
  }
}

export async function updateBalance(email: string, balance: number, totalDeposit?: number) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const updates: { balance: number; updated_at: string; total_deposit?: number } = {
      balance,
      updated_at: new Date().toISOString(),
    };
    if (totalDeposit !== undefined) updates.total_deposit = totalDeposit;

    const { data, error } = await supabase
      .from("balances")
      .update(updates)
      .eq("email", email)
      .select()
      .single();
    if (error) {
      // If row does not exist yet, create it via upsert-compatible insert.
      const { data: inserted, error: insertError } = await supabase
        .from("balances")
        .insert({
          email,
          balance,
          total_deposit: totalDeposit ?? 0,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (insertError) return null;
      return inserted;
    }
    return data;
  } catch {
    return null;
  }
}

export async function addBalance(email: string, amount: number) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const current = await getBalance(email);
    const newBalance = Number(current?.balance ?? 0) + amount;
    return await updateBalance(email, newBalance, current?.total_deposit);
  } catch {
    return null;
  }
}

export async function getTransactions(email?: string, status?: TxStatus, type?: TxType) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    let query = supabase.from("transactions").select("*").order("created_at", { ascending: false });
    if (email) query = query.eq("email", email);
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("type", type);
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function createTransaction(tx: {
  id?: string;
  email: string;
  type: TxType;
  amount: number;
  method: string;
  status: TxStatus;
  receipt_name?: string;
  receipt_url?: string;
  payout_details?: string;
  created_at?: string;
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert(tx)
      .select()
      .single();
    if (error) {
      // Fallback for stricter/older schemas without extra optional columns.
      const fallbackPayload = {
        email: tx.email,
        type: tx.type,
        amount: tx.amount,
        method: tx.method,
        status: tx.status,
        receipt_url: tx.receipt_url,
        payout_details: tx.payout_details,
      };
      const fallback = await supabase
        .from("transactions")
        .insert(fallbackPayload)
        .select()
        .single();
      if (!fallback.error) return fallback.data;

      // Last fallback for very strict schemas, keeps operations flowing.
      const minimalFallback = await supabase
        .from("transactions")
        .insert({
          email: tx.email,
          type: tx.type,
          amount: tx.amount,
          method: tx.method,
          status: tx.status,
        })
        .select()
        .single();
      if (minimalFallback.error) return null;
      return minimalFallback.data;
    }
    return data;
  } catch {
    return null;
  }
}

export async function updateTransactionStatus(id: string, status: Exclude<TxStatus, "pending">) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("transactions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getDevices(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .eq("email", email)
      .order("purchased_at", { ascending: false });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function createDevice(device: {
  email: string;
  plan_code: string;
  plan_price: number;
  daily_income: number;
  total_income: number;
  validity_days: number;
  image?: string;
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("devices")
      .insert({
        ...device,
        earned_amount: 0,
        last_payout_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      // Fallback for schemas without `image` column.
      const fallback = await supabase
        .from("devices")
        .insert({
          email: device.email,
          plan_code: device.plan_code,
          plan_price: device.plan_price,
          daily_income: device.daily_income,
          total_income: device.total_income,
          validity_days: device.validity_days,
          earned_amount: 0,
          last_payout_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (fallback.error) return null;
      return fallback.data;
    }
    return data;
  } catch {
    return null;
  }
}

export async function updateDevice(id: string, updates: { earned_amount?: number; last_payout_at?: string }) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("devices")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getProfits(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("profits")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function createProfit(profit: {
  email: string;
  device_id: string;
  amount: number;
  cycles: number;
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profits")
      .insert(profit)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getNotifications(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function createNotification(notification: {
  email: string;
  title: string;
  message: string;
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert(notification)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function markNotificationAsRead(id: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function deleteNotification(id: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return null;
    return true;
  } catch {
    return null;
  }
}

export async function getAllUsers() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase.from("users").select("email, created_at");
    if (!error && data) return data;

    // Fallback: build user list from balances + transactions when users table is restricted.
    const [balancesRes, txRes] = await Promise.all([
      supabase.from("balances").select("email"),
      supabase.from("transactions").select("email"),
    ]);

    const emails = new Set<string>();
    (balancesRes.data || []).forEach((row: { email?: string }) => {
      if (row.email) emails.add(String(row.email));
    });
    (txRes.data || []).forEach((row: { email?: string }) => {
      if (row.email) emails.add(String(row.email));
    });

    return Array.from(emails).map((email) => ({ email }));
  } catch {
    return [];
  }
}

// RPC wrappers are kept here so App.tsx can use a single import source.
export async function rpcAdminSendNotification(payload: { email: string; title: string; message: string }) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const rpcRes = await supabase.rpc("admin_send_notification", {
      p_email: payload.email,
      p_title: payload.title,
      p_message: payload.message,
    });
    if (!rpcRes.error) return rpcRes.data;

    // Fallback for projects that do not expose this RPC yet.
    return await createNotification(payload);
  } catch {
    return null;
  }
}

export async function rpcBuyDevice(payload: {
  email: string;
  plan_code: string;
  plan_price: number;
  daily_income: number;
  total_income: number;
  validity_days: number;
  image?: string;
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const rpcRes = await supabase.rpc("buy_device", {
      p_email: payload.email,
      p_plan_code: payload.plan_code,
      p_plan_price: payload.plan_price,
      p_daily_income: payload.daily_income,
      p_total_income: payload.total_income,
      p_validity_days: payload.validity_days,
      p_image: payload.image ?? null,
    });
    if (!rpcRes.error) return rpcRes.data;

    // Fallback for projects without RPC: perform regular insert.
    return await createDevice(payload);
  } catch {
    return null;
  }
}

export async function rpcAdminDecideTransaction(txId: string, decision: "approved" | "rejected") {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const rpcRes = await supabase.rpc("admin_decide_transaction", {
      p_tx_id: txId,
      p_decision: decision,
    });
    if (!rpcRes.error) return rpcRes.data;

    // Fallback keeps admin flow working even without RPC.
    return await updateTransactionStatus(txId, decision);
  } catch {
    return null;
  }
}