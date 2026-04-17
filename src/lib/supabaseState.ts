import { supabase, isSupabaseConfigured } from './supabase';

// ==================== USERS ====================
export async function getUserByEmail(email: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
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
      .from('users')
      .insert({ email, password_hash: passwordHash, referred_by: referredBy })
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ==================== BALANCES ====================
export async function getBalance(email: string) {
  if (!isSupabaseConfigured || !supabase) return { balance: 0, total_deposit: 0 };
  try {
    const { data, error } = await supabase
      .from('balances')
      .select('*')
      .eq('email', email)
      .single();
    if (error) {
      // Create balance record if not exists
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
    await supabase.from('balances').insert({ email, balance: 0, total_deposit: 0 });
    return { balance: 0, total_deposit: 0 };
  } catch {
    return null;
  }
}

export async function updateBalance(email: string, balance: number, totalDeposit?: number) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const updates: any = { balance, updated_at: new Date().toISOString() };
    if (totalDeposit !== undefined) updates.total_deposit = totalDeposit;
    const { data, error } = await supabase
      .from('balances')
      .update(updates)
      .eq('email', email)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function addBalance(email: string, amount: number) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data: current } = await getBalance(email);
    const newBalance = (current?.balance || 0) + amount;
    return await updateBalance(email, newBalance, current?.total_deposit);
  } catch {
    return null;
  }
}

// ==================== TRANSACTIONS ====================
export async function getTransactions(email?: string, status?: string, type?: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (email) query = query.eq('email', email);
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function createTransaction(tx: {
  email: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt_url?: string;
  payout_details?: string;
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert(tx)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function updateTransactionStatus(id: string, status: 'approved' | 'rejected') {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ==================== DEVICES ====================
export async function getDevices(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('email', email)
      .order('purchased_at', { ascending: false });
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
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('devices')
      .insert({
        ...device,
        earned_amount: 0,
        last_payout_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function updateDevice(id: string, updates: { earned_amount?: number; last_payout_at?: string }) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('devices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ==================== PROFITS ====================
export async function getProfits(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('profits')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });
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
      .from('profits')
      .insert(profit)
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ==================== NOTIFICATIONS ====================
export async function getNotifications(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });
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
      .from('notifications')
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
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
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
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) return null;
    return true;
  } catch {
    return null;
  }
}

export async function getAllUsers() {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase.from('users').select('email, created_at');
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
