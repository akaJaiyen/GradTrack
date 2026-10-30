create table public.transcript_course_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  code text not null,
  name text not null,
  credits numeric(4,1) not null check (credits > 0),
  grade text,
  term text check (term is null or term in ('1', '2', '3', 'summer')),
  year integer,
  status text not null check (status in ('ready', 'needs_review', 'confirmed')),
  parser text not null check (parser in ('ku_pdf', 'ai')),
  evidence jsonb not null,
  created_at timestamptz not null default now()
);
create index transcript_course_drafts_workspace_document_idx on public.transcript_course_drafts(workspace_id, document_id, created_at);
alter table public.transcript_course_drafts enable row level security;

-- Analyses update the profile and curriculum requirements only. Transcript rows
-- remain drafts until a user explicitly confirms them through the review API.
create or replace function public.replace_academic_profile(
  p_workspace_id uuid, p_extraction jsonb, p_source_document_ids uuid[], p_status text,
  p_consented_at timestamptz, p_courses jsonb, p_requirements jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into academic_profiles (workspace_id, extraction_json, source_document_ids, status, consented_at, extraction_version, updated_at)
  values (p_workspace_id, p_extraction, p_source_document_ids, p_status, p_consented_at, 'typhoon-v1', now())
  on conflict (workspace_id) do update set extraction_json = excluded.extraction_json, source_document_ids = excluded.source_document_ids, status = excluded.status, consented_at = coalesce(academic_profiles.consented_at, excluded.consented_at), extraction_version = excluded.extraction_version, updated_at = now();

  delete from degree_requirements where workspace_id = p_workspace_id and source = 'curriculum';
  insert into degree_requirements (workspace_id, category_name, requirement_type, required_course_code, required_course_name, minimum_credits, prerequisite_data, source, verified_by_user)
  select p_workspace_id, x.category_name, x.requirement_type::requirement_type, x.required_course_code, x.required_course_name, x.minimum_credits, '[]'::jsonb, 'curriculum', false
  from jsonb_to_recordset(p_requirements) as x(category_name text, requirement_type text, required_course_code text, required_course_name text, minimum_credits numeric);
end;
$$;
