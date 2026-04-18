import { supabase } from './supabase'

export async function getBalance(email: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.from('balances').select('balance').eq('email', email).single()
  if (error || !data) return 0
  return Number(data.balance || 0)
}

export async function updateBalance(email: string, newBalance: number): Promise<void> {
  if (!supabase) return
  await supabase.from('balances').upsert({ email, balance: newBalance, updated_at: new Date().toISOString() })
}

export async function getTransactions(email: string): Promise<any[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('transactions').select('*').eq('email', email).order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function createTransaction(tx: any): Promise<void> {
  if (!supabase) return
  await supabase.from('transactions').insert({
    id: tx.id,
    email: tx.email,
    type: tx.type,
    amount: tx.amount,
    method: tx.method,
    status: tx.status,
    receipt_url: tx.receiptDataUrl,
    receipt_name: tx.receiptName,
    payout_details: tx.payoutDetails,
    created_at: tx.createdAt,
  })
}

export async function updateTransactionStatus(id: string, status: 'pending' | 'approved' | 'rejected'): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('transactions').update({ status }).eq('id', id)
  return !error
}

export async function getDevices(email: string): Promise<any[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('devices').select('*').eq('email', email).order('purchased_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function createDevice(device: any): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('devices').insert({
    id: device.id,
    email: device.email,
    plan_code: device.planCode,
    plan_price: device.planPrice,
    daily_income: device.dailyIncome,
    total_income: device.totalIncome,
    validity_days: device.validityDays,
    image: device.image,
    purchased_at: device.purchasedAt,
    earned_amount: device.earnedAmount || 0,
    last_payout_at: device.lastPayoutAt,
  })
  return !error
}

export async function getProfits(email: string): Promise<any[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('profits').select('*').eq('email', email).order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function createProfit(profit: any): Promise<void> {
  if (!supabase) return
  await supabase.from('profits').insert({
    id: profit.id,
    email: profit.email,
    device_id: profit.deviceId,
    amount: profit.amount,
    cycles: profit.cycles,
    created_at: profit.createdAt,
  })
}

export async function getNotifications(email: string): Promise<any[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('notifications').select('*').eq('email', email).order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function createNotification(notification: any): Promise<void> {
  if (!supabase) return
  await supabase.from('notifications').insert({
    id: notification.id,
    email: notification.email,
    title: notification.title,
    message: notification.message,
    is_read: false,
    created_at: new Date().toISOString(),
  })
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)
}

export async function deleteNotification(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('notifications').delete().eq('id', id)
}

export async function createUser(user: any): Promise<void> {
  if (!supabase) return
  await supabase.from('users').insert({
    id: user.id,
    email: user.email,
    password_hash: user.password,
    referred_by: user.referredBy,
    created_at: new Date().toISOString(),
  })
}

export async function getAllUsers(): Promise<any[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('users').select('email')
  if (error) return []
  return data || []
}
