import { supabase, isSupabaseConfigured } from './supabase';

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function getUserByEmail(email: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (error) return null;
  return data;
}

export async function createUser(email: string, passwordValue: string, referredBy?: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const referralCode = generateReferralCode();
  
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: createId('usr'),
        email,
        password: passwordValue, 
        referred_by: referredBy || null,
        referral_code: referralCode,
      },
      { onConflict: 'email' }
    )
    .select()
    .maybeSingle();

  if (error) return null;

  if (referredBy) {
    const { data: inviter } = await supabase
      .from('users')
      .select('email')
      .or(`email.eq.${referredBy},referral_code.eq.${referredBy}`)
      .maybeSingle();

    if (inviter) {
      await supabase.from('referrals').insert({
        user_email: email,
        referrer_email: inviter.email,
        bonus: 0
      });
    }
  }

  return data;
}

export async function getBalance(email: string) {
  if (!isSupabaseConfigured || !supabase) return { balance: 0, total_deposit: 0 };
  const { data } = await supabase.from('balances').select('*').eq('email', email).maybeSingle();
  return data || { balance: 0, total_deposit: 0 };
}

export async function updateBalance(email: string, balance: number, totalDeposit?: number) {
  if (!isSupabaseConfigured || !supabase) return false;
  const updates: any = { balance, updated_at: new Date().toISOString() };
  if (totalDeposit !== undefined) updates.total_deposit = totalDeposit;
  const { error } = await supabase.from('balances').upsert({ email, ...updates }, { onConflict: 'email' });
  return !error;
}

export async function addBalance(email: string, amount: number) {
  const current = await getBalance(email);
  const newBalance = (current?.balance || 0) + amount;
  const newDeposit = (current?.total_deposit || 0) + amount;
  return updateBalance(email, newBalance, newDeposit);
}

export async function getTransactions(email?: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  let query = supabase.from('transactions').select('*');
  if (email) query = query.eq('email', email);
  const { data } = await query.order('created_at', { ascending: false });
  return data || [];
}

export async function createTransaction(tx: any) {
  if (!isSupabaseConfigured || !supabase) return false;
  const { error } = await supabase.from('transactions').insert({
    id: tx.id || `tx_${Date.now()}`,
    ...tx,
    created_at: new Date().toISOString(),
  });
  return !error;
}

export async function handleDepositBonus(userEmail: string, depositAmount: number) {
  const { data: user } = await supabase.from('users').select('referred_by').eq('email', userEmail).single();
  if (user?.referred_by) {
    const { data: inviter } = await supabase
      .from('users')
      .select('email')
      .or(`email.eq.${user.referred_by},referral_code.eq.${user.referred_by}`)
      .maybeSingle();

    if (inviter) {
      const bonus = depositAmount * 0.05;
      await addBalance(inviter.email, bonus);
      await supabase.from('referrals').insert({
        user_email: userEmail,
        referrer_email: inviter.email,
        bonus: bonus
      });
    }
  }
}

export async function updateTransactionStatus(id: string, status: string) {
  if (!isSupabaseConfigured || !supabase) return false;
  const { data: tx } = await supabase.from('transactions').select('*').eq('id', id).single();
  if (!tx) return false;

  const { error } = await supabase.from('transactions').update({ status }).eq('id', id);
  if (error) return false;

  if (status === 'approved' && tx.type === 'deposit') {
    const current = await getBalance(tx.email);
    const newBalance = (current?.balance || 0) + Number(tx.amount);
    const newDeposit = (current?.total_deposit || 0) + Number(tx.amount);
    await updateBalance(tx.email, newBalance, newDeposit);
    await handleDepositBonus(tx.email, Number(tx.amount));
  }

  return true;
}

export async function getDevices(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data } = await supabase.from('devices').select('*').eq('email', email);
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
  const { data } = await supabase.from('devices').update(updates).eq('id', id).select().single();
  return data || null;
}

export async function getNotifications(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data } = await supabase.from('notifications').select('*').eq('email', email);
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
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  return !error;
}

export async function markNotificationAsRead(id: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select().single();
  return data || null;
}

export async function getProfits(email: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data } = await supabase.from('profits').select('*').eq('email', email);
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

export async function getAllUsers() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data } = await supabase.from('users').select('email, created_at');
  return data || [];
}

export async function rpcBuyDevice(input: any) {
  if (!isSupabaseConfigured || !supabase) return { ok: false, message: 'Supabase not configured' };
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
  if (!isSupabaseConfigured || !supabase) return { ok: false, message: 'Supabase not configured' };
  const { data, error } = await supabase.rpc('admin_send_notification', {
    p_user_email: input.user_email,
    p_title: input.title,
    p_message: input.message,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: Boolean((data as any)?.ok), message: (data as any)?.message };
}
