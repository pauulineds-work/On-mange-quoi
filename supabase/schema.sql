-- À coller une seule fois dans Supabase (SQL Editor > New query > Run).
-- Crée le rangement des recettes et des photos, visibles uniquement par leur propriétaire.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  category text not null default '',
  tags text[] not null default '{}',
  prep_minutes integer,
  cook_minutes integer,
  servings text not null default '',
  ingredients text not null default '',
  steps text not null default '',
  notes text not null default '',
  tiktok_ideas text not null default '',
  tiktok_url text not null default '',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

-- Les nouveaux projets Supabase n'ouvrent plus les tables par défaut : on donne l'accès
-- aux personnes connectées (la règle ci-dessous limite chacune à ses propres recettes).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;

drop policy if exists "recettes du proprietaire" on public.recipes;
create policy "recettes du proprietaire" on public.recipes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos du proprietaire" on storage.objects;
create policy "photos du proprietaire" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
