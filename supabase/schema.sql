-- Akşama Ne Var? — DRAFT Postgres schema for a future SupabaseAdapter.
-- Not wired to the app. Mirrors src/data/models.ts (camelCase there, snake_case here).
-- Every household-scoped table carries household_id and is protected by RLS
-- through public.is_member(household_id).

create extension if not exists pgcrypto;

-- ───────────────────────── enums ─────────────────────────
create type course as enum ('corba', 'ana', 'yaninda', 'salata', 'kahvalti', 'tatli');
create type menu_slot as enum ('corba', 'ana', 'yaninda', 'salata');
create type shop_side as enum ('pazar', 'market');
create type plan_day_status as enum ('open', 'ate-out', 'cooked');
create type plan_source as enum ('match', 'favorite', 'manual', 'moved');
create type member_role as enum ('owner', 'member');
create type swipe_decision as enum ('like', 'pass');
create type match_status as enum ('open', 'placed', 'returned');
create type task_status as enum ('pending', 'done');

-- ───────────────────────── people ─────────────────────────
-- Auth lives in auth.users; profiles hold the app fields (name, avatar initial, onboarded).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar_initial text not null check (char_length(avatar_initial) between 1 and 2),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique check (invite_code ~ '^[a-z2-9]{4}-[a-z2-9]{2}$'),
  dinner_time time not null default '19:30',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role member_role not null default 'member',
  color text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id), -- one household per person (matches the app)
  unique (household_id, user_id)
);
create index on public.household_members (household_id);

-- Membership check used by every RLS policy. SECURITY DEFINER avoids RLS recursion on household_members.
create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- Max two members (the product is built for "ikiniz").
create or replace function public.enforce_member_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.household_members where household_id = new.household_id) >= 2 then
    raise exception 'household_full';
  end if;
  return new;
end $$;
create trigger household_member_limit before insert on public.household_members
  for each row execute function public.enforce_member_limit();

-- ───────────────────────── recipes ─────────────────────────
-- household_id null = built-in recipe (seeded from src/data/seed). Ingredients, prep items
-- and steps are jsonb arrays validated by the app's zod schemas; normalise later if needed.
create table public.recipes (
  id text primary key,                         -- built-ins use slugs ("izmir-kofte"), custom ones uuid text
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  short_name text,
  course course not null,
  prep_minutes int not null check (prep_minutes >= 0),
  cook_minutes int not null check (cook_minutes >= 0),
  time_note text,
  servings int not null check (servings >= 1),
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]',     -- [{name, quantity, unit, side, aisle, staple?, note?}]
  prep_items jsonb not null default '[]',      -- [{label, offset: 'night-before'|'morning'|'-60min', freezer?}]
  steps text[] not null default '{}',
  leftover_friendly boolean not null default false,
  freezer_item text,
  source text,
  stub boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.recipes (household_id);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, recipe_id)
);
create index on public.favorites (recipe_id);

-- ───────────────────────── plan ─────────────────────────
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  slot menu_slot not null,
  recipe_id text not null references public.recipes (id) on delete restrict, -- app shows "Silinmiş tarif"; soft-delete recipes instead
  source plan_source not null default 'manual',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, date, slot)
);
create index on public.plan_items (household_id, date);
create index on public.plan_items (recipe_id);

create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  status plan_day_status not null default 'open',
  approvals uuid[] not null default '{}',
  leftovers boolean not null default false,
  returned_recipe_ids text[] not null default '{}',
  cooked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, date)
);

create table public.cook_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, recipe_id, date)
);
create index on public.cook_log (household_id, recipe_id, date desc);

-- ───────────────────────── shopping ─────────────────────────
-- The list itself is derived (plan + recipes − pantry); only manual items, checks and pantry are stored.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity numeric check (quantity > 0),
  unit text,
  side shop_side not null,
  aisle text not null,
  for_recipe_id text references public.recipes (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.shopping_items (household_id);

create table public.shopping_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null,              -- "i:<ingredient-slug>" or "m:<shopping_item id>"
  checked_by uuid not null references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, item_key)      -- last write wins (upsert)
);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity numeric check (quantity > 0),  -- null = "evde var" without an amount
  unit text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pantry_items (household_id, name);

-- ───────────────────────── prep tasks ─────────────────────────
create table public.prep_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  recipe_id text not null references public.recipes (id) on delete cascade,
  label text not null,
  "offset" text not null check ("offset" ~ '^(night-before|morning|-[0-9]+min)$'),
  freezer boolean not null default false,
  due_at timestamptz not null,
  assignee_id uuid references public.profiles (id) on delete set null,
  status task_status not null default 'pending',
  done_by uuid references public.profiles (id) on delete set null,
  done_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, date, recipe_id, label)
);
create index on public.prep_tasks (household_id, due_at);

-- ───────────────────────── swipes & matches ─────────────────────────
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  date date not null,
  slot menu_slot not null,
  decision swipe_decision not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id, recipe_id, date, slot)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  date date not null,
  slot menu_slot not null,
  status match_status not null default 'open',
  placed_date date,
  returned_from date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, recipe_id, date, slot)
);

-- ───────────────────────── activity ─────────────────────────
create table public.activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.activity (household_id, created_at desc);

-- ───────────────────────── updated_at ─────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','households','household_members','recipes','favorites','plan_items','plan_days',
    'cook_log','shopping_items','shopping_checks','pantry_items','prep_tasks','swipes','matches','activity']
  loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.recipes enable row level security;
alter table public.favorites enable row level security;
alter table public.plan_items enable row level security;
alter table public.plan_days enable row level security;
alter table public.cook_log enable row level security;
alter table public.shopping_items enable row level security;
alter table public.shopping_checks enable row level security;
alter table public.pantry_items enable row level security;
alter table public.prep_tasks enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.activity enable row level security;

-- Profiles: you, and the people you share a household with.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.household_members a join public.household_members b on a.household_id = b.household_id
    where a.user_id = (select auth.uid()) and b.user_id = profiles.id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- Households: members read/update; anyone signed in may create one they own.
create policy households_select on public.households for select to authenticated using (public.is_member(id));
create policy households_insert on public.households for insert to authenticated with check (created_by = (select auth.uid()));
create policy households_update on public.households for update to authenticated using (public.is_member(id));

-- Members: read your household; join/leave only as yourself. Joining by invite code goes
-- through the join_household() RPC below (the code is the capability, not a table read).
create policy members_select on public.household_members for select to authenticated using (public.is_member(household_id));
create policy members_insert_self on public.household_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy members_delete_self on public.household_members for delete to authenticated using (user_id = (select auth.uid()));

-- Recipes: built-ins readable by all; household recipes by members.
create policy recipes_select on public.recipes for select to authenticated
  using (household_id is null or public.is_member(household_id));
create policy recipes_write on public.recipes for all to authenticated
  using (household_id is not null and public.is_member(household_id))
  with check (household_id is not null and public.is_member(household_id));

-- Everything else: members of the household can read and write.
do $$
declare t text;
begin
  foreach t in array array['favorites','plan_items','plan_days','cook_log','shopping_items','shopping_checks',
    'pantry_items','prep_tasks','matches','activity']
  loop
    execute format('create policy %1$s_member on public.%1$s for all to authenticated
      using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
  end loop;
end $$;

-- Swipes: you only ever read/write your own rows, so the partner's choices stay hidden.
create policy swipes_own on public.swipes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(household_id));

-- Partner progress ("Zeynep 12 kartın 8'ini kaydırdı") without exposing decisions.
create or replace function public.swipe_progress(hid uuid, d date, s menu_slot, recipe_ids text[])
returns table (user_id uuid, swiped int)
language sql stable security definer set search_path = '' as $$
  select sw.user_id, count(*)::int
  from public.swipes sw
  where public.is_member(hid) and sw.household_id = hid and sw.date = d and sw.slot = s
    and sw.recipe_id = any(recipe_ids)
  group by sw.user_id;
$$;

-- Matching runs in the database: when every member liked the same card, create the match.
create or replace function public.detect_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare members int; likes int;
begin
  if new.decision <> 'like' then return new; end if;
  select count(*) into members from public.household_members where household_id = new.household_id;
  select count(distinct user_id) into likes from public.swipes
    where household_id = new.household_id and recipe_id = new.recipe_id and date = new.date and slot = new.slot and decision = 'like';
  if likes >= members then
    insert into public.matches (household_id, recipe_id, date, slot, created_by)
    values (new.household_id, new.recipe_id, new.date, new.slot, new.user_id)
    on conflict (household_id, recipe_id, date, slot) do nothing;
  end if;
  return new;
end $$;
create trigger swipes_detect_match after insert or update on public.swipes
  for each row execute function public.detect_match();

-- Invite lookup + join, without exposing households to non-members.
create or replace function public.lookup_invite(code text)
returns table (household_id uuid, owner_name text, member_count int, favorite_names text[])
language sql stable security definer set search_path = '' as $$
  select h.id, p.name,
    (select count(*)::int from public.household_members m where m.household_id = h.id),
    array(select r.name from public.favorites f join public.recipes r on r.id = f.recipe_id where f.household_id = h.id)
  from public.households h join public.profiles p on p.id = h.created_by
  where h.invite_code = lower(code);
$$;

create or replace function public.join_household(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare hid uuid; n int; used text[];
begin
  select id into hid from public.households where invite_code = lower(code);
  if hid is null then raise exception 'invite_missing'; end if;
  select count(*), array_agg(color) into n, used from public.household_members where household_id = hid;
  if n >= 2 then raise exception 'household_full'; end if;
  insert into public.household_members (household_id, user_id, role, color, created_by)
  values (hid, (select auth.uid()), 'member',
          case when '#55612A' = any(coalesce(used, '{}')) then '#9A5512' else '#55612A' end,
          (select auth.uid()));
  insert into public.activity (household_id, actor_id, type, created_by)
  values (hid, (select auth.uid()), 'household.joined', (select auth.uid()));
  return hid;
end $$;

-- Realtime: publish household tables so a SupabaseAdapter can feed the SyncBus.
alter publication supabase_realtime add table
  public.plan_items, public.plan_days, public.shopping_items, public.shopping_checks, public.pantry_items,
  public.prep_tasks, public.matches, public.activity, public.favorites, public.household_members;
