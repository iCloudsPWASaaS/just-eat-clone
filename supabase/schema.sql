-- =============================================================================
--  Woodfarm Kebab & Pizza ("justeat") — Postgres schema for Supabase
-- =============================================================================
--  Run against the Supabase project with one of:
--    psql "$DATABASE_URL" -f supabase/schema.sql
--    supabase db execute --file supabase/schema.sql
--
--  The app talks to this schema via NEXT_PUBLIC_SUPABASE_SCHEMA=justeat, which
--  lib/supabase.ts passes through as `db.schema` on the PostgREST client.
--
--  Everything a signed-out visitor needs is world-readable. Everything tied to
--  an account is locked down with auth.uid() so the anon key can never read or
--  write another customer's data.
-- =============================================================================

create schema if not exists justeat;
set search_path = justeat, public;

-- ---------------------------------------------------------------------------
-- Reusable trigger: keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RESTAURANTS
-- ---------------------------------------------------------------------------
create table if not exists justeat.restaurants (
  id                    uuid primary key default gen_random_uuid(),
  source_id             text unique,
  slug                  text unique not null,
  name                  text not null,
  description           text,
  cuisines              text[] not null default '{}',
  address_line1         text not null,
  address_line2         text,
  city                  text not null,
  postcode              text not null,
  latitude              double precision,
  longitude             double precision,
  phone                 text,
  website               text,
  logo_url              text,
  hero_image_url        text,
  rating                numeric(2,1) not null default 0,
  rating_count          integer not null default 0,
  food_hygiene_rating   smallint,
  price_range           text default '£',
  delivery_fee          numeric(10,2) not null default 0,
  small_order_threshold numeric(10,2) not null default 0,
  minimum_order_value   numeric(10,2) not null default 0,
  service_fee_percent   numeric(5,2) not null default 0,
  delivery_eta_min      integer not null default 30,
  delivery_eta_max      integer not null default 45,
  collection_eta_min    integer not null default 20,
  is_delivery           boolean not null default true,
  is_collection         boolean not null default true,
  is_preorder           boolean not null default false,
  is_halal              boolean not null default false,
  is_vegetarian         boolean not null default false,
  accepts_cod           boolean not null default true,
  contactless           boolean not null default true,
  is_active             boolean not null default true,
  keyword_seo_title     text,
  keyword_seo_desc      text,
  provenance            jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint restaurants_rating_range check (rating >= 0 and rating <= 5)
);

drop trigger if exists trg_restaurants_updated_at on justeat.restaurants;
create trigger trg_restaurants_updated_at
  before update on justeat.restaurants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- OPENING HOURS  (day_of_week 0 = Monday, matching JS getDay() convention
-- after normalisation in the app layer)
-- ---------------------------------------------------------------------------
create table if not exists justeat.opening_hours (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  label         text not null,
  open_time     time,
  close_time    time,
  is_closed     boolean not null default false,
  unique (restaurant_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- DELIVERY ZONES (postcode -> ETA, powers the postcode checker)
-- ---------------------------------------------------------------------------
create table if not exists justeat.delivery_zones (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  postcode      text not null,
  distance_km   numeric(6,2) not null default 0,
  eta_minutes   integer not null,
  is_deliverable boolean not null default true
);
create index if not exists delivery_zones_postcode_idx
  on justeat.delivery_zones (postcode);

-- ---------------------------------------------------------------------------
-- MENU
-- ---------------------------------------------------------------------------
create table if not exists justeat.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  source_id     text,
  name          text not null,
  slug          text not null,
  description   text,
  image_url     text,
  sort_order    integer not null default 0,
  is_featured   boolean not null default false,
  unique (restaurant_id, slug)
);

create table if not exists justeat.menu_items (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references justeat.menu_categories(id) on delete cascade,
  restaurant_id  uuid not null references justeat.restaurants(id) on delete cascade,
  source_id      text,
  name           text not null,
  slug           text not null,
  description    text,
  image_url      text,
  calories       integer,
  base_price     numeric(10,2) not null default 0,
  is_vegetarian  boolean not null default false,
  is_vegan       boolean not null default false,
  is_halal       boolean not null default true,
  is_spicy       boolean not null default false,
  is_popular     boolean not null default false,
  is_available   boolean not null default true,
  sort_order     integer not null default 0,
  search_vector  tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);
create index if not exists menu_items_category_idx on justeat.menu_items (category_id, sort_order);
create index if not exists menu_items_restaurant_idx on justeat.menu_items (restaurant_id);
create index if not exists menu_items_search_idx on justeat.menu_items using gin (search_vector);

create table if not exists justeat.menu_item_variations (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references justeat.menu_items(id) on delete cascade,
  source_id   text,
  name        text not null,
  display_name text,
  price       numeric(10,2) not null default 0,
  calories    integer,
  is_default  boolean not null default false,
  is_available boolean not null default true,
  sort_order  integer not null default 0
);
create index if not EXISTS menu_item_variations_item_idx
  on justeat.menu_item_variations (item_id, sort_order);

-- Modifier groups are the "choose your ..." pickers ("Choose Your Salad",
-- "Choose Extra Toppings"). min_select drives required vs optional and
-- max_select drives single-choice (radio) vs multi-choice (checkbox): 1 means
-- radio, anything higher allows repeats with a quantity stepper.
create table if not exists justeat.modifier_groups (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references justeat.restaurants(id) on delete cascade,
  -- stable hash of (name, min, max, options) from the source payload, so a
  -- re-import reuses the same row instead of creating a duplicate group
  source_id      text,
  name           text not null,
  description    text,
  min_select     integer not null default 0 check (min_select >= 0),
  max_select     integer not null default 1 check (max_select >= 1),
  sort_order     integer not null default 0
);

-- Groups attach to a *variation*, not to the item. A 14" and a 10" of the same
-- pizza carry different groups because the topping price differs (+£1.80 vs
-- +£1.20), so per-item linking could not represent this menu.
create table if not exists justeat.modifier_group_variations (
  group_id     uuid not null references justeat.modifier_groups(id) on delete cascade,
  variation_id uuid not null references justeat.menu_item_variations(id) on delete cascade,
  sort_order   integer not null default 0,
  primary key (group_id, variation_id)
);
create index if not exists modifier_group_variations_variation_idx
  on justeat.modifier_group_variations (variation_id, sort_order);

-- The original item-level link. Retained so an older importer or admin tool
-- that still populates it keeps working; the app reads the variation table.
create table if not exists justeat.modifier_group_items (
  group_id   uuid not null references justeat.modifier_groups(id) on delete cascade,
  item_id    uuid not null references justeat.menu_items(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (group_id, item_id)
);

create table if not exists justeat.modifier_options (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references justeat.modifier_groups(id) on delete cascade,
  name          text not null,
  description   text,
  -- added to the variation price per unit of this option
  price_delta   numeric(10,2) not null default 0,
  is_available  boolean not null default true,
  sort_order    integer not null default 0,
  unique (group_id, name)
);
create index if not exists modifier_options_group_idx
  on justeat.modifier_options (group_id, sort_order);

-- Idempotent upgrades for databases created before modifier support landed.
alter table justeat.modifier_groups add column if not exists source_id text;
alter table justeat.modifier_groups add column if not exists description text;
alter table justeat.modifier_options add column if not exists description text;

-- A group with the same name twice in a row cannot be told apart, so collapse
-- any such duplicates before adding the uniqueness guarantee.
delete from justeat.modifier_options a
  using justeat.modifier_options b
 where a.ctid < b.ctid
   and a.group_id = b.group_id
   and a.name = b.name;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'modifier_options_group_name_key'
  ) then
    alter table justeat.modifier_options
      add constraint modifier_options_group_name_key unique (group_id, name);
  end if;
end
$$;
create unique index if not exists modifier_groups_source_key
  on justeat.modifier_groups (restaurant_id, source_id)
  where source_id is not null;

-- ---------------------------------------------------------------------------
-- DEALS / PROMOTIONS
-- ---------------------------------------------------------------------------
create table if not exists justeat.deals (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  title         text not null,
  subtitle      text,
  description   text,
  discount_type text not null default 'percentage'
    check (discount_type in ('percentage', 'fixed', 'free_delivery', 'bogo')),
  discount_value numeric(10,2) not null default 0,
  min_order_value numeric(10,2) not null default 0,
  badge         text,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------------
create table if not exists justeat.faqs (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  question      text not null,
  answer        text not null,
  sort_order    integer not null default 0
);

-- ---------------------------------------------------------------------------
-- ACCOUNTS
-- ---------------------------------------------------------------------------
create table if not exists justeat.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  first_name    text,
  last_name     text,
  phone         text,
  avatar_url    text,
  marketing_opt_in boolean not null default false,
  push_opt_in   boolean not null default true,
  sms_opt_in    boolean not null default false,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Idempotent upgrade for databases created before the admin flag existed.
alter table justeat.profiles add column if not exists is_admin boolean not null default false;
create unique index if not exists profiles_email_key on justeat.profiles (lower(email));

drop trigger if exists trg_profiles_updated_at on justeat.profiles;
create trigger trg_profiles_updated_at
  before update on justeat.profiles
  for each row execute function public.set_updated_at();

-- Mirror every new auth signup into justeat.profiles so the account area is
-- never empty after registration, even if the client-side insert is skipped.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into justeat.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'firstName',
    new.raw_user_meta_data ->> 'lastName',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ADDRESSES
-- ---------------------------------------------------------------------------
create table if not exists justeat.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text not null default 'Home',
  first_name    text not null,
  last_name     text not null,
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  postcode      text not null,
  phone         text,
  delivery_notes text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists addresses_user_idx on justeat.addresses (user_id);

drop trigger if exists trg_addresses_updated_at on justeat.addresses;
create trigger trg_addresses_updated_at
  before update on justeat.addresses
  for each row execute function public.set_updated_at();

-- Only one default address per user.
create or replace function public.enforce_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update justeat.addresses
       set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_single_default_address on justeat.addresses;
create trigger trg_single_default_address
  before insert or update on justeat.addresses
  for each row execute function public.enforce_single_default_address();

-- ---------------------------------------------------------------------------
-- FAVOURITES
-- ---------------------------------------------------------------------------
create table if not exists justeat.favourites (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  item_id   uuid not null references justeat.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);
create index if not exists favourites_user_idx on justeat.favourites (user_id);

-- ---------------------------------------------------------------------------
-- PERSISTENT BASKET
-- ---------------------------------------------------------------------------
create table if not exists justeat.basket_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      uuid not null references justeat.menu_items(id) on delete cascade,
  variation_id uuid references justeat.menu_item_variations(id) on delete cascade,
  quantity     integer not null default 1 check (quantity > 0 and quantity <= 50),
  notes        text,
  -- Chosen modifier options as {optionId, groupId, quantity}. Snapshotted
  -- names/prices are not stored here because this table is a scratch basket;
  -- the authoritative copy is written onto order_items at checkout.
  modifiers    jsonb not null default '[]'::jsonb check (jsonb_typeof(modifiers) = 'array'),
  fulfilment_type text not null default 'delivery'
    check (fulfilment_type in ('delivery', 'collection')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table justeat.basket_items add column if not exists
  modifiers jsonb not null default '[]'::jsonb;
create index if not exists basket_items_user_idx on justeat.basket_items (user_id);

drop trigger if exists trg_basket_items_updated_at on justeat.basket_items;
create trigger trg_basket_items_updated_at
  before update on justeat.basket_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
create table if not exists justeat.orders (
  id               uuid primary key default gen_random_uuid(),
  reference        text unique not null,
  user_id          uuid not null references auth.users(id) on delete cascade,
  restaurant_id    uuid not null references justeat.restaurants(id) on delete restrict,
  address_id       uuid references justeat.addresses(id) on delete set null,
  fulfilment_type  text not null check (fulfilment_type in ('delivery', 'collection')),
  status           text not null default 'pending'
    check (status in ('pending','confirmed','preparing','out_for_delivery','collected','delivered','cancelled')),
  -- address is snapshotted at checkout so later edits to the address book
  -- cannot rewrite order history
  delivery_address jsonb,
  contact_name     text,
  contact_phone    text,
  customer_notes   text,
  subtotal         numeric(10,2) not null default 0,
  delivery_fee      numeric(10,2) not null default 0,
  service_fee      numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  payment_method   text not null default 'card'
    check (payment_method in ('card','cash','paypal')),
  promo_code       text,
  eta_minutes      integer,
  placed_at        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_idx on justeat.orders (user_id, placed_at desc);
create index if not exists orders_restaurant_idx on justeat.orders (restaurant_id, placed_at desc);

drop trigger if exists trg_orders_updated_at on justeat.orders;
create trigger trg_orders_updated_at
  before update on justeat.orders
  for each row execute function public.set_updated_at();

create table if not exists justeat.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references justeat.orders(id) on delete cascade,
  item_id      uuid references justeat.menu_items(id) on delete set null,
  variation_id uuid references justeat.menu_item_variations(id) on delete set null,
  -- names/prices are snapshotted for the same reason as the address
  name         text not null,
  variation_name text,
  -- unit_price and line_total already include the modifier deltas; this column
  -- keeps the kitchen readable ("large kebab: rice, garlic mayo"), so the
  -- choices are snapshotted with their names rather than referenced.
  modifiers    jsonb not null default '[]'::jsonb check (jsonb_typeof(modifiers) = 'array'),
  unit_price   numeric(10,2) not null,
  quantity     integer not null check (quantity > 0),
  notes        text,
  line_total   numeric(10,2) not null
);
create index if not exists order_items_order_idx on justeat.order_items (order_id);
alter table justeat.order_items add column if not exists
  modifiers jsonb not null default '[]'::jsonb;

create table if not exists justeat.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references justeat.orders(id) on delete cascade,
  status     text not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx
  on justeat.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------------
-- REVIEWS
-- ---------------------------------------------------------------------------
create table if not exists justeat.reviews (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  author_name   text not null,
  rating        smallint not null check (rating between 1 and 5),
  title         text,
  comment       text,
  -- 1 = delivery, 2 = collection
  fulfilment_type smallint check (fulfilment_type in (1, 2)),
  is_verified_order boolean not null default false,
  restaurant_reply text,
  created_at    timestamptz not null default now()
);
create index if not exists reviews_restaurant_idx
  on justeat.reviews (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- PROMO CODES
-- ---------------------------------------------------------------------------
create table if not exists justeat.promo_codes (
  id           uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references justeat.restaurants(id) on delete cascade,
  code         text not null,
  description  text,
  discount_type text not null default 'fixed'
    check (discount_type in ('percentage','fixed','free_delivery')),
  discount_value numeric(10,2) not null default 0,
  min_order_value numeric(10,2) not null default 0,
  max_uses     integer,
  used_count   integer not null default 0,
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_active    boolean not null default true,
  unique (restaurant_id, code)
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table justeat.restaurants            enable row level security;
alter table justeat.opening_hours          enable row level security;
alter table justeat.delivery_zones         enable row level security;
alter table justeat.menu_categories        enable row level security;
alter table justeat.menu_items             enable row level security;
alter table justeat.menu_item_variations    enable row level security;
alter table justeat.modifier_groups        enable row level security;
alter table justeat.modifier_group_items   enable row level security;
alter table justeat.modifier_group_variations enable row level security;
alter table justeat.modifier_options       enable row level security;
alter table justeat.deals                  enable row level security;
alter table justeat.faqs                   enable row level security;
alter table justeat.profiles               enable row level security;
alter table justeat.addresses              enable row level security;
alter table justeat.favourites             enable row level security;
alter table justeat.basket_items           enable row level security;
alter table justeat.orders                 enable row level security;
alter table justeat.order_items            enable row level security;
alter table justeat.order_status_history   enable row level security;
alter table justeat.reviews                enable row level security;
alter table justeat.promo_codes            enable row level security;

-- --- Public catalogue: readable by anyone (incl. anon), writable by service role only.
drop policy if exists restaurants_read on justeat.restaurants;
create policy restaurants_read on justeat.restaurants
  for select using (is_active);

do $$
declare
  t text;
begin
  foreach t in array array[
    'opening_hours','delivery_zones','menu_categories','menu_items','menu_item_variations',
    'modifier_groups','modifier_group_items','modifier_group_variations','modifier_options',
    'deals','faqs'
  ] loop
    execute format('drop policy if exists %I on justeat.%I;', t || '_read', t);
    execute format(
      'create policy %I on justeat.%I for select using (true);', t || '_read', t);
  end loop;
end
$$;

-- Promo codes must not be enumerable by anonymous visitors.
drop policy if exists promo_codes_read on justeat.promo_codes;
create policy promo_codes_read on justeat.promo_codes
  for select to authenticated
  using (is_active and (starts_at is null or starts_at <= now())
             and (ends_at is null or ends_at >= now()));

-- --- Profiles: own row only.
drop policy if exists profiles_select_own on justeat.profiles;
create policy profiles_select_own on justeat.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_insert_own on justeat.profiles;
create policy profiles_insert_own on justeat.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_own on justeat.profiles;
create policy profiles_update_own on justeat.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_delete_own on justeat.profiles;
create policy profiles_delete_own on justeat.profiles
  for delete to authenticated using (auth.uid() = id);

-- --- Addresses: owner only, no public visibility.
drop policy if exists addresses_own on justeat.addresses;
create policy addresses_own on justeat.addresses
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- Favourites: owner only.
drop policy if exists favourites_own on justeat.favourites;
create policy favourites_own on justeat.favourites
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- Basket: owner only.
drop policy if exists basket_items_own on justeat.basket_items;
create policy basket_items_own on justeat.basket_items
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- Orders: owner only. The insert check allows the `pending` status only, so
-- a client cannot forge a delivered/cancelled order.
drop policy if exists orders_select_own on justeat.orders;
create policy orders_select_own on justeat.orders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists orders_insert_own on justeat.orders;
create policy orders_insert_own on justeat.orders
  for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists orders_update_own on justeat.orders;
create policy orders_update_own on justeat.orders
  for update to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id);

-- --- Order line items: readable if you own the parent order, and insertable
-- only alongside a pending order you own.
drop policy if exists order_items_read_own on justeat.order_items;
create policy order_items_read_own on justeat.order_items
  for select to authenticated
  using (exists (select 1 from justeat.orders o where o.id = order_id and o.user_id = auth.uid()));

drop policy if exists order_items_insert_own on justeat.order_items;
create policy order_items_insert_own on justeat.order_items
  for insert to authenticated
  with check (exists (
    select 1 from justeat.orders o
    where o.id = order_id and o.user_id = auth.uid() and o.status = 'pending'));

-- --- Order status history: readable by the owner only.
drop policy if exists order_status_history_read_own on justeat.order_status_history;
create policy order_status_history_read_own on justeat.order_status_history
  for select to authenticated
  using (exists (select 1 from justeat.orders o where o.id = order_id and o.user_id = auth.uid()));

-- --- Reviews: everyone can read; signed-in users can post their own, and only
-- ever as themselves. Nothing here is updatable/deletable by the author — that
-- is a moderation decision, not a self-service one.
drop policy if exists reviews_read on justeat.reviews;
create policy reviews_read on justeat.reviews
  for select using (true);

drop policy if exists reviews_insert_own on justeat.reviews;
create policy reviews_insert_own on justeat.reviews
  for insert to authenticated
  with check (auth.uid() = user_id and author_name is not null and length(trim(author_name)) > 0);

-- =============================================================================
-- GRANTS
-- =============================================================================
grant usage on schema justeat to anon, authenticated, service_role;

-- The service role runs the importer, so it needs full catalogue write access.
-- (Supabase's service_role role is not a superuser; it only touches schemas it
-- has been granted, so allowing it explicitly is required for scripts/import.mjs.)
grant select, insert, update, delete on all tables in schema justeat
  to service_role;
grant usage, select on all sequences in schema justeat to service_role;

-- The anon key only ever needs to read the public catalogue.
grant select on
  justeat.restaurants,
  justeat.opening_hours,
  justeat.delivery_zones,
  justeat.menu_categories,
  justeat.menu_items,
  justeat.menu_item_variations,
  justeat.modifier_groups,
  justeat.modifier_group_items,
  justeat.modifier_group_variations,
  justeat.modifier_options,
  justeat.deals,
  justeat.faqs,
  justeat.reviews
to anon, authenticated;

-- Signed-in customers additionally get full control of their own rows.
grant select, insert, update, delete on
  justeat.profiles,
  justeat.addresses,
  justeat.favourites,
  justeat.basket_items,
  justeat.orders,
  justeat.order_items
to authenticated;

grant select on justeat.order_status_history to authenticated;
grant select on justeat.promo_codes to authenticated;
grant insert on justeat.reviews to authenticated;
-- `on conflict` upserts in scripts/import.mjs run as the service role, which
-- bypasses RLS, so no anon/authenticated write grant is needed for the catalogue.
