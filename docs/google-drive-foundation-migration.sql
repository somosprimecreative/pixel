-- Prime Creative shared Google Drive foundation.
-- This migration is intentionally product-neutral. Pixel is the only product
-- that writes folders at this stage; no Órbita folder or policy is created.
-- Run it once in the central Prime Supabase project, after reviewing it.

create table if not exists public.google_drive_connections (
  team_member_id uuid primary key references public.team_members(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_auth_tag text not null,
  refresh_token_key_version text not null,
  refresh_token_encryption text not null default 'aes-256-gcm:v1',
  prime_creative_folder_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade the previous Pixel-only shape without assuming that it exists.
alter table if exists public.google_drive_connections
  add column if not exists refresh_token_auth_tag text,
  add column if not exists refresh_token_key_version text,
  add column if not exists refresh_token_encryption text,
  add column if not exists prime_creative_folder_id text;

do $$
begin
  -- folder_id was the old Pixel-only destination. Preserve it for audit and
  -- backwards inspection, but remove its obsolete requirement.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'google_drive_connections'
      and column_name = 'folder_id'
  ) then
    execute 'alter table public.google_drive_connections alter column folder_id drop not null';
  end if;

  -- The compound key makes a folder connection impossible to attach to a
  -- different workspace than its member's OAuth connection.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.google_drive_connections'::regclass
      and conname = 'google_drive_connections_member_workspace_key'
  ) then
    alter table public.google_drive_connections
      add constraint google_drive_connections_member_workspace_key
      unique (team_member_id, workspace_id);
  end if;

  -- Existing legacy rows remain readable only for deletion/reconnection.
  -- Every new or changed secure row must include the complete AES-GCM record.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.google_drive_connections'::regclass
      and conname = 'google_drive_connections_secure_token_check'
  ) then
    alter table public.google_drive_connections
      add constraint google_drive_connections_secure_token_check
      check (
        refresh_token_encryption is null
        or (
          refresh_token_encryption = 'aes-256-gcm:v1'
          and nullif(refresh_token_auth_tag, '') is not null
          and nullif(refresh_token_key_version, '') is not null
          and nullif(prime_creative_folder_id, '') is not null
        )
      ) not valid;
  end if;
end
$$;

create table if not exists public.google_drive_folders (
  team_member_id uuid not null,
  workspace_id uuid not null,
  product_key text not null check (product_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  folder_key text not null check (folder_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  google_drive_folder_id text not null check (nullif(google_drive_folder_id, '') is not null),
  parent_google_drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_member_id, product_key, folder_key),
  constraint google_drive_folders_connection_fkey
    foreign key (team_member_id, workspace_id)
    references public.google_drive_connections (team_member_id, workspace_id)
    on delete cascade
);

create index if not exists google_drive_folders_member_workspace_idx
  on public.google_drive_folders (team_member_id, workspace_id);

alter table public.google_drive_connections enable row level security;
alter table public.google_drive_folders enable row level security;

-- No browser role can read OAuth tokens or folder topology directly.
revoke all on table public.google_drive_connections from public, anon, authenticated;
revoke all on table public.google_drive_folders from public, anon, authenticated;
grant select, insert, update, delete on table public.google_drive_connections to service_role;
grant select, insert, update, delete on table public.google_drive_folders to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'google_drive_connections'
      and policyname = 'google_drive_connections_no_client_access'
  ) then
    create policy google_drive_connections_no_client_access
      on public.google_drive_connections
      for all to anon, authenticated
      using (false) with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'google_drive_folders'
      and policyname = 'google_drive_folders_no_client_access'
  ) then
    create policy google_drive_folders_no_client_access
      on public.google_drive_folders
      for all to anon, authenticated
      using (false) with check (false);
  end if;
end
$$;

create or replace function public.update_google_drive_connection_timestamp()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_google_drive_connections_updated_at
  on public.google_drive_connections;
create trigger trg_google_drive_connections_updated_at
  before update on public.google_drive_connections
  for each row execute function public.update_google_drive_connection_timestamp();

drop trigger if exists trg_google_drive_folders_updated_at
  on public.google_drive_folders;
create trigger trg_google_drive_folders_updated_at
  before update on public.google_drive_folders
  for each row execute function public.update_google_drive_connection_timestamp();

comment on table public.google_drive_connections is
  'OAuth connections per Prime member. Refresh tokens are stored only as AES-256-GCM ciphertext by a server-side product.';
comment on column public.google_drive_connections.prime_creative_folder_id is
  'Google Drive ID of the member-specific Prime Creative root folder.';
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'google_drive_connections'
      and column_name = 'folder_id'
  ) then
    execute $comment$
      comment on column public.google_drive_connections.folder_id is
        'Legacy Pixel-only folder ID. Deprecated after the shared Prime Creative folder foundation.'
    $comment$;
  end if;
end
$$;
comment on table public.google_drive_folders is
  'Product-owned Google Drive folders. Product-specific folder rules are implemented by each product server.';
