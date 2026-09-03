-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  category text not null,        -- top | bottom | dress | outerwear | shoes | accessory
  subcategory text,               -- e.g. t-shirt, jeans, sneakers
  primary_color text,
  secondary_colors text[] default '{}',
  pattern text,                   -- solid, striped, floral, plaid, graphic, etc.
  seasons text[] default '{}',    -- spring, summer, fall, winter
  style_tags text[] default '{}', -- casual, formal, sporty, business, streetwear...
  material text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_ids uuid[] not null,
  occasion text,
  rationale text,
  created_at timestamptz not null default now()
);

alter table public.clothing_items enable row level security;
alter table public.outfits enable row level security;

drop policy if exists "Users manage their own clothing items" on public.clothing_items;
create policy "Users manage their own clothing items"
  on public.clothing_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own outfits" on public.outfits;
create policy "Users manage their own outfits"
  on public.outfits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for clothing photos. Create it in the dashboard (Storage -> New bucket,
-- name "clothing-images", keep it PRIVATE), then run the policies below.
insert into storage.buckets (id, name, public)
values ('clothing-images', 'clothing-images', false)
on conflict (id) do nothing;

drop policy if exists "Users manage files in their own folder" on storage.objects;
create policy "Users manage files in their own folder"
  on storage.objects
  for all
  using (bucket_id = 'clothing-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'clothing-images' and (storage.foldername(name))[1] = auth.uid()::text);
