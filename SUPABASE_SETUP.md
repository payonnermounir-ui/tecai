# Supabase Setup (TECAI)

1. Create a new Supabase project.
2. Open SQL Editor and run this normalized schema (recommended):

```sql
create table if not exists public.profiles (
  phone text primary key,
  login_password text not null,
  payment_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  phone text primary key references public.profiles(phone) on delete cascade,
  balance numeric(16,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.withdrawal_channels (
  id text primary key,
  phone text not null references public.profiles(phone) on delete cascade,
  provider text not null,
  holder_name text not null,
  channel_phone text not null,
  account_number text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  phone text not null,
  type text not null,
  amount numeric(16,4) not null,
  method text not null,
  status text not null,
  payout_details text,
  receipt_name text,
  receipt_data_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id text primary key,
  phone text not null,
  plan_code text not null,
  plan_price numeric(16,4) not null,
  daily_income numeric(16,4) not null,
  total_income numeric(16,4) not null,
  validity_days int not null,
  image text not null,
  purchased_at timestamptz not null,
  earned_amount numeric(16,4) not null default 0,
  hourly_rate numeric(16,6) not null default 0,
  last_payout_at timestamptz
);

create table if not exists public.profit_records (
  id text primary key,
  phone text not null,
  device_id text not null,
  amount numeric(16,4) not null,
  cycles int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.withdrawal_channels enable row level security;
alter table public.transactions enable row level security;
alter table public.devices enable row level security;
alter table public.profit_records enable row level security;
alter table public.app_meta enable row level security;

drop policy if exists "public_rw_profiles" on public.profiles;
create policy "public_rw_profiles" on public.profiles for all to anon using (true) with check (true);

drop policy if exists "public_rw_wallets" on public.wallets;
create policy "public_rw_wallets" on public.wallets for all to anon using (true) with check (true);

drop policy if exists "public_rw_channels" on public.withdrawal_channels;
create policy "public_rw_channels" on public.withdrawal_channels for all to anon using (true) with check (true);

drop policy if exists "public_rw_transactions" on public.transactions;
create policy "public_rw_transactions" on public.transactions for all to anon using (true) with check (true);

drop policy if exists "public_rw_devices" on public.devices;
create policy "public_rw_devices" on public.devices for all to anon using (true) with check (true);

drop policy if exists "public_rw_profit_records" on public.profit_records;
create policy "public_rw_profit_records" on public.profit_records for all to anon using (true) with check (true);

drop policy if exists "public_rw_app_meta" on public.app_meta;
create policy "public_rw_app_meta" on public.app_meta for all to anon using (true) with check (true);

-- Optional legacy table support. Keep this table only if you still use old versions.
create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow anon read app_state" on public.app_state;
create policy "Allow anon read app_state" on public.app_state for select to anon using (true);

drop policy if exists "Allow anon upsert app_state" on public.app_state;
create policy "Allow anon upsert app_state" on public.app_state for all to anon using (true) with check (true);
```

3. Copy `.env.example` to `.env`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project settings.
5. Restart the Vite dev server.

If env values are missing, the app will keep working with local storage automatically.

The app now auto-detects schema mode:
1. If normalized tables exist, they are used.
2. If not, it falls back to the legacy `app_state` table.
