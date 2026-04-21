import { supabase, isSupabaseConfigured } from './supabase';

// ==================== HELPERS ====================
function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ==================== USERS ====================
export async function getUserByEmail(email: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user:', error.message);
    return null;
  }

  return data;
}

export async function createUser(email: string, passwordHash: string, referredBy?: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const referralCode = generateReferralCode();

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: createId('usr'),
        email,
        password_hash: passwordHash,
        referred_by: referredBy || null,
        referral_code: referralCode,
      },
      { onConflict: 'email' }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error('Create user error:', error.message);
    return null;
  }

  // ==================== REFERRAL SYSTEM ====================
  if (referredBy) {
    const { data: refUser } = await supabase
      .from('users')
      .select('email')
      .eq('referral_code', referredBy)
      .single();

    if (refUser?.email) {
      await addBalance(refUser.email, 5);
    }
  }

  return data || null;
}

// ==================== BALANCES ====================
export async function getBalance(email: string) {
  if (!isSupabaseConfigured || !supabase)
    return { balance: 0, total_deposit: 0 };

  const { data } = await supabase
    .from('balances')
    .select('*')
    .eq('email', email)
    .single();

  return data || { balance: 0, total_deposit: 0 };
}

export async function updateBalance(email: string, balance: number, totalDeposit?: number) {
  if (!isSupabaseConfigured || !supabase) return false;

  const updates: any = {
    balance,
    updated_at: new Date().toISOString(),
  };

  if (totalDeposit !== undefined) updates.total_deposit = totalDeposit;

  const { error } = await supabase
    .from('balances')
    .update(updates)
    .eq('email', email);

  return !error;
}

export async function addBalance(email: string, amount: number) {
  const current = await getBalance(email);

  const newBalance = (current?.balance || 0) + amount;
  const newDeposit = (current?.total_deposit || 0) + amount;

  return updateBalance(email, newBalance, newDeposit);
}

// ==================== TRANSACTIONS ====================
export async function getTransactions(email?: string) {
  if (!isSupabaseConfigured || !supabase) return [];

  let query = supabase.from('transactions').select('*');

  if (email) query = query.eq('email', email);

  const { data } = await query;
  return data || [];
}

export async function createTransaction(tx: any) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase.from('transactions').insert({
    id: tx.id || `tx_${Date.now()}`,
    ...tx,
    created_at: new Date().toISOString(),
  });

  if (error) return false;

  // ==================== REFERRAL SYSTEM (FIXED) ====================
  if (tx.type === 'deposit' && tx.status === 'completed') {

    const { data: user } = await supabase
      .from('users')
      .select('referred_by')
      .eq('email', tx.email)
      .single();

    if (user?.referred_by) {

      const bonus = Number(tx.amount) * 0.05;

      // 🔥 FIX: جلب المحيل عبر referral_code
      const { data: referrer } = await supabase
        .from('users')
        .select('email')
        .eq('referral_code', user.referred_by)
        .single();

      if (!referrer?.email) return true;

      // تحديث الرصيد عبر النظام الموحد
      await addBalance(referrer.email, bonus);

      // تسجيل الإحالة
      await supabase.from('referrals').insert({
        user_email: tx.email,
        referrer_email: referrer.email,
        bonus: bonus
      });
    }
  }

  return true;
}

// ==================== 🔥 FIXED DEPOSIT APPROVAL ====================
export async function updateTransactionStatus(id: string, status: string) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { data: tx } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (!tx) return false;

  const { error } = await supabase
    .from('transactions')
    .update({ status })
    .eq('id', id);

  if (error) return false;

  if (status === 'approved' && tx.type === 'deposit') {
    const current = await getBalance(tx.email);

    const newBalance = (current?.balance || 0) + Number(tx.amount);
    const newDeposit = (current?.total_deposit || 0) + Number(tx.amount);

    await updateBalance(tx.email, newBalance, newDeposit);
  }

  return true;
}

// ==================== DEVICES ====================
export async function getDevices(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('email', email);

  return data || [];
}

export async function createDevice(device: any) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase.from('devices').insert({
    id: createId('dv'),
    ...device,
    earned_amount: 0,
    last_payout_at: new Date().toISOString(),
    purchased_at: new Date().toISOString(),
  });

  return !error;
}

export async function updateDevice(id: string, updates: any) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return data || null;
}

// ==================== NOTIFICATIONS ====================
export async function getNotifications(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('email', email);

  return data || [];
}

export async function createNotification(notification: any) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase.from('notifications').insert({
    id: createId('ntf'),
    ...notification,
    is_read: false,
    created_at: new Date().toISOString(),
  });

  return !error;
}

export async function deleteNotification(id: string) {
  if (!isSupabaseConfigured || !supabase) return false;

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  return !error;
}

export async function markNotificationAsRead(id: string) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .select()
    .single();

  return data || null;
}

// ==================== PROFITS ====================
export async function getProfits(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data } = await supabase
    .from('profits')
    .select('*')
    .eq('email', email);

  return data || [];
}

export async function createProfit(profit: any) {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data } = await supabase.from('profits').insert({
    id: `prf_${Date.now()}`,
    ...profit,
  }).select().single();

  return data || null;
}

// ==================== EXTRA ====================
export async function getAllUsers() {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data } = await supabase
    .from('users')
    .select('email, created_at');

  return data || [];
}

// ==================== RPC ====================
export async function rpcBuyDevice(input: any) {
  if (!isSupabaseConfigured || !supabase)
    return { ok: false, message: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('user_buy_device', {
    p_plan_code: input.plan_code,
    p_plan_price: input.plan_price,
    p_daily_income: input.daily_income,
    p_total_income: input.total_income,
    p_validity_days: input.validity_days,
    p_image: input.image || '',
  });

  if (error) return { ok: false, message: error.message };

  return { ok: Boolean((data as any)?.ok), message: (data as any)?.message };
}

export async function rpcAdminSendNotification(input: any) {
  if (!isSupabaseConfigured || !supabase)
    return { ok: false, message: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_user_email: input.user_email,
    p_title: input.title,
    p_message: input.message,
  });

  if (error) return { ok: false, message: error.message };

  return { ok: Boolean((data as any)?.ok), message: (data as any)?.message };
}
