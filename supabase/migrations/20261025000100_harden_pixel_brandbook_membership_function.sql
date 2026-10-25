-- Keep the RLS helper out of the PostgREST-exposed public schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

drop policy if exists "Pixel workspace read" on public.pixel_brand_projects;
drop policy if exists "Pixel workspace write" on public.pixel_brand_projects;
drop policy if exists "Pixel workspace read" on public.pixel_brand_documents;
drop policy if exists "Pixel workspace write" on public.pixel_brand_documents;
drop policy if exists "Pixel workspace read" on public.pixel_brand_assets;
drop policy if exists "Pixel workspace write" on public.pixel_brand_assets;
drop policy if exists "Pixel workspace read" on public.pixel_brand_color_tokens;
drop policy if exists "Pixel workspace write" on public.pixel_brand_color_tokens;
drop policy if exists "Pixel workspace read" on public.pixel_brand_typography_tokens;
drop policy if exists "Pixel workspace write" on public.pixel_brand_typography_tokens;
drop policy if exists "Pixel workspace read" on public.pixel_brand_document_sections;
drop policy if exists "Pixel workspace write" on public.pixel_brand_document_sections;
drop policy if exists "Pixel workspace read" on public.pixel_brand_document_versions;
drop policy if exists "Pixel workspace write" on public.pixel_brand_document_versions;
drop policy if exists "Pixel workspace read" on public.pixel_brand_jobs;
drop policy if exists "Pixel workspace write" on public.pixel_brand_jobs;
drop policy if exists "Pixel workspace read" on public.pixel_brand_exports;
drop policy if exists "Pixel workspace write" on public.pixel_brand_exports;

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

drop function if exists public.pixel_has_active_workspace_membership(uuid);

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
    execute format('create policy "Pixel workspace read" on public.%I for select to authenticated using (private.pixel_has_active_workspace_membership(workspace_id))', table_name);
  end loop;
end;
$$;

create policy "Pixel workspace write" on public.pixel_brand_projects for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
create policy "Pixel workspace write" on public.pixel_brand_documents for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
create policy "Pixel workspace write" on public.pixel_brand_assets for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
create policy "Pixel workspace write" on public.pixel_brand_color_tokens for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
create policy "Pixel workspace write" on public.pixel_brand_typography_tokens for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
create policy "Pixel workspace write" on public.pixel_brand_document_sections for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
create policy "Pixel workspace write" on public.pixel_brand_document_versions for all to authenticated using (private.pixel_has_active_workspace_membership(workspace_id)) with check (private.pixel_has_active_workspace_membership(workspace_id));
