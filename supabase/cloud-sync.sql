-- Run this once in Supabase Dashboard -> SQL Editor.
-- The app syncs only link metadata; local audio Blobs are never uploaded.
create table if not exists public.user_library_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{"tracks":[],"playlists":[],"favorites":[],"updatedAt":null}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_library_snapshots enable row level security;
revoke all on public.user_library_snapshots from anon;
grant select, insert, update, delete on public.user_library_snapshots to authenticated;

drop policy if exists "Users can read their own A-SRITI snapshot" on public.user_library_snapshots;
create policy "Users can read their own A-SRITI snapshot"
  on public.user_library_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own A-SRITI snapshot" on public.user_library_snapshots;
create policy "Users can insert their own A-SRITI snapshot"
  on public.user_library_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own A-SRITI snapshot" on public.user_library_snapshots;
create policy "Users can update their own A-SRITI snapshot"
  on public.user_library_snapshots for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own A-SRITI snapshot" on public.user_library_snapshots;
create policy "Users can delete their own A-SRITI snapshot"
  on public.user_library_snapshots for delete to authenticated
  using ((select auth.uid()) = user_id);
