create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric not null default 0,
  stock integer not null default 0,
  accent text not null default 'bg-[#f66f4d]',
  image_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists image_url text not null default '';

create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null,
  customer_name text not null,
  contact text not null,
  note text not null default '',
  items jsonb not null,
  total numeric not null default 0,
  screenshot_name text not null default '',
  screenshot_url text not null default '',
  status text not null check (status in ('pending', 'paid', 'rejected')),
  feishu_record_id text,
  feishu_sync_status text check (
    feishu_sync_status is null
    or feishu_sync_status in ('skipped', 'synced', 'failed')
  ),
  feishu_sync_message text
);

insert into public.products (
  id,
  name,
  description,
  price,
  stock,
  accent,
  image_url,
  is_active
)
values
  (
    'ticket',
    '活动入场券',
    '单人入场凭证，现场核对订单姓名。',
    68,
    45,
    'bg-[#f66f4d]',
    '',
    true
  ),
  (
    'bag',
    '限定帆布袋',
    '活动限定周边，到场凭已支付订单领取。',
    39,
    18,
    'bg-[#3b82f6]',
    '',
    true
  ),
  (
    'badge',
    '纪念徽章套组',
    '三枚一组，库存有限，售完即止。',
    26,
    0,
    'bg-[#16a34a]',
    '',
    true
  )
on conflict (id) do nothing;

-- Create a public bucket named payment-screenshots in Supabase Storage.
-- Keep writes server-side via SUPABASE_SERVICE_ROLE_KEY.
