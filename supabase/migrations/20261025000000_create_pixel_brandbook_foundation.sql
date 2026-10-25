-- Pixel · fundação de Brandbooks
--
-- Aplique esta migration APENAS no Supabase compartilhado do ecossistema Prime,
-- que já possui public.workspaces e public.team_members. Ela não deve ser
-- aplicada em um projeto Supabase isolado ou de teste sem esse modelo de acesso.
--
-- Esta migration não cria usuários, memberships, dados de marca, jobs executáveis
-- ou acesso público a arquivos. O backend do Pixel é responsável por validar a
-- sessão e a associação ativa antes de usar a service role.

create table if not exists public.pixel_brand_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_member_id uuid not null references public.team_members(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  client_name text,
  industry text,
  description text,
  purpose text,
  audience text,
  tone_of_voice text,
  language text not null default 'Português (Brasil)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pixel_brand_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.pixel_brand_projects(id) on delete cascade,
  created_by_member_id uuid not null references public.team_members(id) on delete restrict,
  kind text not null check (kind in ('brandbook', 'identity_presentation')),
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed', 'archived')),
  theme_key text not null check (theme_key in ('editorial', 'system', 'expressive')),
  theme_variant text not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  selected_sections jsonb not null default '[]'::jsonb,
  generation_plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pixel_brand_documents_project_workspace_unique unique (id, workspace_id)
);

create table if not exists public.pixel_brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.pixel_brand_projects(id) on delete cascade,
  uploaded_by_member_id uuid not null references public.team_members(id) on delete restrict,
  role text not null check (role in ('primary_logo', 'alternate_logo', 'pattern', 'graphic', 'icon', 'illustration', 'photograph', 'mockup', 'other')),
  label text not null check (char_length(trim(label)) between 1 and 160),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/svg+xml', 'image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 12582912),
  sort_order integer not null default 0 check (sort_order >= 0),
  recommended_background text not null default 'both' check (recommended_background in ('light', 'dark', 'both')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pixel_brand_color_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.pixel_brand_projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  hex_value text not null check (hex_value ~ '^#[0-9A-Fa-f]{6}$'),
  role text not null check (role in ('primary', 'secondary', 'accent', 'neutral_light', 'neutral_dark', 'support')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pixel_brand_typography_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.pixel_brand_projects(id) on delete cascade,
  role text not null check (role in ('display', 'body', 'support')),
  family_name text not null check (char_length(trim(family_name)) between 1 and 160),
  source_kind text not null default 'system' check (source_kind in ('system', 'google', 'uploaded', 'other')),
  asset_id uuid references public.pixel_brand_assets(id) on delete set null,
  weight_range text,
  usage_notes text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pixel_brand_document_sections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.pixel_brand_documents(id) on delete cascade,
  section_type text not null check (section_type in ('cover', 'overview', 'logo_system', 'color_palette', 'typography', 'graphic_elements', 'applications', 'closing')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  summary text not null default '',
  layout_key text not null check (char_length(trim(layout_key)) between 1 and 80),
  position integer not null check (position >= 0),
  is_visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pixel_brand_document_sections_position_unique unique (document_id, position)
);

create table if not exists public.pixel_brand_document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.pixel_brand_documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  created_by_member_id uuid not null references public.team_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint pixel_brand_document_versions_unique unique (document_id, version_number)
);

-- Jobs são persistidos desde já. Um worker/cron poderá consumi-los depois,
-- sem mudar o contrato do documento ou do frontend.
create table if not exists public.pixel_brand_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.pixel_brand_documents(id) on delete cascade,
  requested_by_member_id uuid not null references public.team_members(id) on delete restrict,
  job_type text not null check (job_type in ('generate_plan', 'render_preview', 'export_pdf', 'publish_document')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pixel_brand_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.pixel_brand_documents(id) on delete cascade,
  requested_by_member_id uuid not null references public.team_members(id) on delete restrict,
  export_kind text not null check (export_kind in ('pdf', 'zip', 'presentation_link')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  storage_path text,
  error_message text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pixel_brand_projects_workspace_updated_idx on public.pixel_brand_projects (workspace_id, updated_at desc);
create index if not exists pixel_brand_documents_workspace_updated_idx on public.pixel_brand_documents (workspace_id, updated_at desc);
create index if not exists pixel_brand_assets_project_sort_idx on public.pixel_brand_assets (project_id, sort_order);
create index if not exists pixel_brand_sections_document_position_idx on public.pixel_brand_document_sections (document_id, position);
create index if not exists pixel_brand_jobs_pending_idx on public.pixel_brand_jobs (status, next_attempt_at, created_at) where status in ('queued', 'processing');
create index if not exists pixel_brand_exports_document_created_idx on public.pixel_brand_exports (document_id, created_at desc);

create or replace function public.pixel_brandbook_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.pixel_has_active_workspace_membership(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members member
    where member.workspace_id = target_workspace_id
      and member.auth_user_id = auth.uid()
      and member.status = 'active'
  );
$$;

revoke all on function private.pixel_has_active_workspace_membership(uuid) from public;
grant execute on function private.pixel_has_active_workspace_membership(uuid) to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'pixel_brand_projects',
    'pixel_brand_documents',
    'pixel_brand_assets',
    'pixel_brand_color_tokens',
    'pixel_brand_typography_tokens',
    'pixel_brand_document_sections',
    'pixel_brand_document_versions',
    'pixel_brand_jobs',
    'pixel_brand_exports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Pixel workspace read" on public.%I', table_name);
    execute format('drop policy if exists "Pixel workspace write" on public.%I', table_name);
    execute format('create policy "Pixel workspace read" on public.%I for select to authenticated using (private.pixel_has_active_workspace_membership(workspace_id))', table_name);
    execute format('create policy "Pixel workspace write" on public.%I for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id))', table_name);
  end loop;
end;
$$;

-- Jobs e exports são criados e atualizados somente pelas rotas server-side.
-- Pessoas autenticadas podem acompanhar o próprio workspace, mas não alterar
-- estado, payload, tentativas ou caminhos de arquivo diretamente pelo browser.
drop policy if exists "Pixel workspace write" on public.pixel_brand_jobs;
drop policy if exists "Pixel workspace write" on public.pixel_brand_exports;

drop trigger if exists pixel_brand_projects_set_updated_at on public.pixel_brand_projects;
create trigger pixel_brand_projects_set_updated_at before update on public.pixel_brand_projects for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_documents_set_updated_at on public.pixel_brand_documents;
create trigger pixel_brand_documents_set_updated_at before update on public.pixel_brand_documents for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_assets_set_updated_at on public.pixel_brand_assets;
create trigger pixel_brand_assets_set_updated_at before update on public.pixel_brand_assets for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_color_tokens_set_updated_at on public.pixel_brand_color_tokens;
create trigger pixel_brand_color_tokens_set_updated_at before update on public.pixel_brand_color_tokens for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_typography_tokens_set_updated_at on public.pixel_brand_typography_tokens;
create trigger pixel_brand_typography_tokens_set_updated_at before update on public.pixel_brand_typography_tokens for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_document_sections_set_updated_at on public.pixel_brand_document_sections;
create trigger pixel_brand_document_sections_set_updated_at before update on public.pixel_brand_document_sections for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_jobs_set_updated_at on public.pixel_brand_jobs;
create trigger pixel_brand_jobs_set_updated_at before update on public.pixel_brand_jobs for each row execute function public.pixel_brandbook_set_updated_at();
drop trigger if exists pixel_brand_exports_set_updated_at on public.pixel_brand_exports;
create trigger pixel_brand_exports_set_updated_at before update on public.pixel_brand_exports for each row execute function public.pixel_brandbook_set_updated_at();

-- Bucket privado: os arquivos devem ser enviados, lidos e assinados somente por
-- rotas de servidor que validem a membership. Não há policy de browser aqui.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pixel-brandbook-assets',
  'pixel-brandbook-assets',
  false,
  12582912,
  array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
