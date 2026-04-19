import { supabase, isSupabaseConfigured } from './supabase';

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
      .upsert({ id: createId('usr'), email, password_hash: passwordHash, referred_by: referredBy }, { onConflict: 'email' })
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

export async function updateBalance(email: string, balance: number, totalDeposit?: number): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.error('Supabase not configured for balance update');
    return false;
  }
  try {
    console.log('Updating balance for', email, 'to', balance);
    const updates: any = { balance, updated_at: new Date().toISOString() };
    if (totalDeposit !== undefined) updates.total_deposit = totalDeposit;
    const { data, error } = await supabase
      .from('balances')
      .update(updates)
      .eq('email', email)
      .select()
      .single();
    if (error) {
      console.error('Balance update error:', error);
      return false;
    }
    console.log('Balance updated successfully:', data);
    return true;
  } catch (e) {
    console.error('Balance update exception:', e);
    return false;
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
  id?: string;
  email: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt_url?: string;
  receipt_name?: string;
  payout_details?: string;
  created_at?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.error('Supabase not configured for transaction');
    return false;
  }
  try {
    console.log('Creating transaction:', tx);
    const insertData: any = { 
      id: tx.id || `tx_${Date.now()}`,
      email: tx.email,
      type: tx.type,
      amount: tx.amount,
      method: tx.method,
      status: tx.status,
      receipt_url: tx.receipt_url,
      receipt_name: tx.receipt_name,
      payout_details: tx.payout_details,
        created_at: tx.created_at || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('transactions')
      .insert(insertData)
      .select()
      .single();
    if (error) {
      console.error('Create transaction error:', error);
      return false;
    }
    console.log('Transaction created successfully:', data);
    return true;
  } catch (e) {
    console.error('Create transaction exception:', e);
    return false;
  }
}

export async function updateTransactionStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  fallback?: { email: string; type: 'deposit' | 'withdraw'; amount: number; created_at: string },
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.error('Supabase not configured');
    return false;
  }
  try {
    console.log('Updating transaction', id, 'to', status);
    const { data, error } = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', id)
      .select('id');

    if (!error && data && data.length > 0) {
      console.log('Transaction updated successfully by id:', data[0]);
      return true;
    }

    // Fallback 1: same transaction signature, exact created_at.
    if (fallback) {
      const fb = await supabase
        .from('transactions')
        .update({ status })
        .eq('email', fallback.email)
        .eq('type', fallback.type)
        .eq('amount', fallback.amount)
        .eq('created_at', fallback.created_at)
        .select('id');

      if (!fb.error && fb.data && fb.data.length > 0) {
        console.log('Transaction updated successfully by fallback:', fb.data[0]);
        return true;
      }
      if (fb.error) {
        console.error('Update transaction fallback error:', fb.error);
      }

      // Fallback 2: latest pending row for same signature.
      const latestPending = await supabase
        .from('transactions')
        .select('id')
        .eq('email', fallback.email)
        .eq('type', fallback.type)
        .eq('amount', fallback.amount)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestPending.error && latestPending.data?.id) {
        const fb2 = await supabase
          .from('transactions')
          .update({ status })
          .eq('id', latestPending.data.id)
          .select('id');
        if (!fb2.error && fb2.data && fb2.data.length > 0) {
          console.log('Transaction updated by pending fallback:', fb2.data[0]);
          return true;
        }
        if (fb2.error) {
          console.error('Update transaction pending fallback error:', fb2.error);
        }
      }
    }

    if (error) {
      console.error('Update transaction error:', error);
      return false;
    }
    return false;
  } catch (e) {
    console.error('Update transaction exception:', e);
    return false;
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
  image?: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    console.error('Supabase not configured for device');
    return false;
  }
  try {
    console.log('Creating device:', device);
    const { data, error } = await supabase
      .from('devices')
      .insert({
        id: createId('dv'),
        email: device.email,
        plan_code: device.plan_code,
        plan_price: device.plan_price,
        daily_income: device.daily_income,
        total_income: device.total_income,
        validity_days: device.validity_days,
        image: device.image || '',
        earned_amount: 0,
        last_payout_at: new Date().toISOString(),
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.error('Create device error:', error);
      return false;
    }
    console.log('Device created successfully:', data);
    return true;
  } catch (e) {
    console.error('Create device exception:', e);
    return false;
  }
}

export async function updateDevice(id: string, updates: { earned_amount?: number; last_payout_at?: string }) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('devices')
      .update({ ...updates })
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
      .insert({
        id: createId('prf'),
        email: profit.email,
        device_id: profit.device_id,
        amount: profit.amount,
        cycles: profit.cycles,
      })
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
      .insert({
        id: createId('ntf'),
        email: notification.email,
        title: notification.title,
        message: notification.message,
        is_read: false,
        created_at: new Date().toISOString(),
      })
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
