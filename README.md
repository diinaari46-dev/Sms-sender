# SMS Reminder Dashboard 📱💰

A production-quality, responsive web application built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Supabase JS Client (`@supabase/supabase-js`)**.

This dashboard serves as the central control panel for an automated debt reminder system in Somalia. Store owners and business operators manage customer balances, compose personalized SMS reminder campaigns in Somali and English, and queue them to a central outbox. A companion Android gateway app reads the queue and sends the SMS messages using local SIM cards (e.g., Hormuud Telecom).

---

## Features

### 1. Phone + Password Authentication
- **Dual Tab Screen**: Seamless switching between **Login** and **Create Account**.
- **Somali Phone Normalization**: Accepts `61xxxxxxx`, `061xxxxxxx`, `25261xxxxxxx`, and `+25261xxxxxxx`, automatically converting them to canonical `+25261xxxxxxx`.
- **Supabase Auth Bridge**: Maps the phone number to an internal email identifier (`${normalizedPhoneDigits}@smsapp.local`) for password authentication without requiring SMS OTP during web sign-in.
- **Friendly Bilingual Errors**: Informative messages in Somali and English (`"Taleefanka ama furaha sirta ah waa khalad"`, `"Akoonkan horey ayaa loo diiwaangeliyay"`).
- **Persistent Session**: Auto-redirects, displays user's phone in the top navigation, and provides safe sign-out.

### 2. Live Dashboard & Gateway Telemetry
- **Key Metrics**: Real-time summary cards for **Total Customers**, **Total Owed ($)**, **Sent Today**, **Pending**, **Failed**, and **Delivered**.
- **Android Gateway Status**: Real-time heartbeat detection (**Online** if `last_seen < 60s` ago, otherwise **Offline**), live battery percentage indicator, and emergency dispatch status.
- **Activity Chart**: Custom 7-day volume visualization of messages sent per calendar day.
- **Realtime Sync**: Subscribes to Supabase Realtime for instant background updates when the Android app updates dispatch status.

### 3. Customer Directory
- **Searchable & Sortable**: Search by customer name or phone; sort ascending/descending by name, phone, or balance.
- **Inline Balance Editing**: Click directly on any balance value to quickly update owed amounts on the fly.
- **Debtor Filtering**: Quick toggle for `Balance > 0` to focus immediately on customers who owe money.
- **Add / Edit / Delete Modals**: Full validation with confirmation dialogs for destructive actions.
- **Bulk Delete**: Select multiple customers and delete them in a single batch.
- **CSV & Excel Import**: Upload `.csv`, `.xlsx`, or `.xls` files with a visual preview modal; automatically normalizes Somali phone numbers and upserts records on duplicate phone numbers.
- **CSV Export**: Download customer lists into clean CSV format anytime.

### 4. 3-Step SMS Campaign Composer
- **Step 1: Select Recipients**: Filter and check recipients with a "Select All" option; displays total balance selected.
- **Step 2: Template Editor**:
  - Insert `{name}` and `{amount}` variable placeholders with one click.
  - Character counter and SMS parts counter (160 characters per SMS part).
  - Save, load, and delete reusable templates.
  - Pre-filled with standard Somali reminder:
    `"Salaan {name}, waxaa kugu leeyahay {amount}. Fadlan bixi {amount} adigoo mahadsan."`
- **Step 3: Live Preview & Queue**:
  - Displays personalized message previews for every selected customer.
  - Allows editing individual messages before queuing.
  - Computes estimated dispatch duration (`count × average gateway delay`).
  - Creates the campaign and inserts rows into `outbox` for selected customers only.

### 5. Campaigns & Outbox Queue Management
- **Campaign Cards**: Visual progress bars showing delivered, sent, pending, and failed counts per campaign.
- **Realtime Outbox Table**: Live status badges (`pending`, `sending`, `sent`, `delivered`, `failed`, `paused`).
- **Campaign Controls**:
  - **Pause Campaign**: Pauses pending messages.
  - **Resume Campaign**: Requeues paused messages.
  - **Retry Failed**: Resets failed messages back to pending.
  - **Cancel Pending**: Deletes un-sent messages with confirmation.
  - **Export Report**: Downloads delivery logs to CSV.

### 6. Gateway Settings & Setup Guide
- **Emergency Stop Toggle**: Immediately halts the gateway from sending messages.
- **Throttling Delays**: Configure `min_delay_ms` and `max_delay_ms` between consecutive SMS dispatches.
- **Daily SMS Limit**: Set daily dispatch caps to protect against carrier throttling or blocks.
- **Language Switcher**: Toggle interface between **Somali** (default) and **English**.
- **Change Password**: Update dashboard password directly from account settings.
- **Gateway Setup Guide Card**: Visual 3-step walkthrough for configuring the companion Android app.

---

## Environment Variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

> **Note**: If `VITE_SUPABASE_URL` is omitted in the AI Studio development environment, the dashboard runs with a high-fidelity local Supabase emulator pre-seeded with Somali customer and campaign records so all features are interactive right away.

---

## Supabase Database Schema

Run this SQL snippet in your Supabase SQL Editor if you are setting up the tables from scratch:

```sql
-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Customers Table
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() not null,
  name text not null,
  phone text not null,
  balance numeric(10,2) default 0 not null,
  created_at timestamptz default now() not null,
  constraint customers_user_phone_unique unique(user_id, phone)
);

alter table public.customers enable row level security;
create policy "Users manage own customers" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Templates Table
create table if not exists public.templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() not null,
  title text not null,
  body text not null,
  created_at timestamptz default now() not null
);

alter table public.templates enable row level security;
create policy "Users manage own templates" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Campaigns Table
create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() not null,
  title text not null,
  template_body text not null,
  total int default 0 not null,
  status text default 'queued' not null check (status in ('draft', 'pending', 'queued', 'running', 'sending', 'paused', 'done', 'completed', 'cancelled', 'failed')),
  created_at timestamptz default now() not null
);

alter table public.campaigns enable row level security;
create policy "Users manage own campaigns" on public.campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Outbox Table
create table if not exists public.outbox (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid default auth.uid() not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  phone text not null,
  message text not null,
  status text default 'pending' not null check (status in ('pending', 'sending', 'sent', 'delivered', 'failed', 'paused')),
  error text,
  attempts int default 0 not null,
  created_at timestamptz default now() not null,
  sent_at timestamptz,
  delivered_at timestamptz
);

alter table public.outbox enable row level security;
create policy "Users manage own outbox" on public.outbox
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Gateway Table
create table if not exists public.gateway (
  user_id uuid primary key default auth.uid(),
  company_name text,
  is_enabled boolean default true not null,
  min_delay_ms int default 3000 not null,
  max_delay_ms int default 7000 not null,
  daily_limit int default 300 not null,
  last_seen timestamptz,
  battery int
);

alter table public.gateway enable row level security;
create policy "Users manage own gateway" on public.gateway
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. RPC: send_campaign (Selected customers)
create or replace function public.send_campaign(
  p_title text,
  p_template text,
  p_customer_ids uuid[]
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_campaign_id uuid;
  v_customer record;
  v_company text := '';
  v_msg text;
  v_count int := 0;
begin
  select coalesce(company_name, '') into v_company
  from public.gateway
  where user_id = auth.uid()
  limit 1;

  insert into public.campaigns (title, template_body, total, status)
  values (p_title, p_template, coalesce(array_length(p_customer_ids, 1), 0), 'queued')
  returning id into v_campaign_id;

  for v_customer in
    select id, name, phone, balance
    from public.customers
    where user_id = auth.uid() and id = any(p_customer_ids)
  loop
    v_msg := replace(p_template, '{name}', v_customer.name);
    v_msg := replace(v_msg, '{amount}', '$' || to_char(v_customer.balance, 'FM999,999,990.00'));
    v_msg := replace(v_msg, '{company}', v_company);

    insert into public.outbox (campaign_id, customer_id, phone, message, status)
    values (v_campaign_id, v_customer.id, v_customer.phone, v_msg, 'pending');

    v_count := v_count + 1;
  end loop;

  update public.campaigns set total = v_count where id = v_campaign_id;
  return v_campaign_id;
end;
$$;

-- 8. RPC: create_campaign (By minimum balance)
create or replace function public.create_campaign(
  p_title text,
  p_template text,
  p_min_balance numeric default 0
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_campaign_id uuid;
  v_customer record;
  v_company text := '';
  v_msg text;
  v_count int := 0;
begin
  select coalesce(company_name, '') into v_company
  from public.gateway
  where user_id = auth.uid()
  limit 1;

  insert into public.campaigns (title, template_body, total, status)
  values (p_title, p_template, 0, 'queued')
  returning id into v_campaign_id;

  for v_customer in
    select id, name, phone, balance
    from public.customers
    where user_id = auth.uid() and balance >= p_min_balance
  loop
    v_msg := replace(p_template, '{name}', v_customer.name);
    v_msg := replace(v_msg, '{amount}', '$' || to_char(v_customer.balance, 'FM999,999,990.00'));
    v_msg := replace(v_msg, '{company}', v_company);

    insert into public.outbox (campaign_id, customer_id, phone, message, status)
    values (v_campaign_id, v_customer.id, v_customer.phone, v_msg, 'pending');

    v_count := v_count + 1;
  end loop;

  update public.campaigns set total = v_count where id = v_campaign_id;
  return v_campaign_id;
end;
$$;
```

---

## Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and supply your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## Deploying to Vercel or Netlify

### Vercel
1. Push your repository to GitHub or GitLab.
2. In the Vercel Dashboard, click **New Project** and select the repository.
3. Framework Preset: **Vite**.
4. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**.

### Netlify
1. Connect the repository in Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. In **Site Configuration > Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy Site**.
