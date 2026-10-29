alter type document_type add value if not exists 'academic_source';

create table public.academic_profiles (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  extraction_json jsonb not null,
  source_document_ids uuid[] not null default '{}',
  status text not null check (status in ('processing', 'ready', 'ready_with_warnings', 'failed')),
  consented_at timestamptz,
  extraction_version text not null,
  updated_at timestamptz not null default now()
);

alter table public.academic_profiles enable row level security;

create or replace function public.replace_academic_profile(
  p_workspace_id uuid,
  p_extraction jsonb,
  p_source_document_ids uuid[],
  p_status text,
  p_consented_at timestamptz,
  p_courses jsonb,
  p_requirements jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into academic_profiles (workspace_id, extraction_json, source_document_ids, status, consented_at, extraction_version, updated_at)
  values (p_workspace_id, p_extraction, p_source_document_ids, p_status, p_consented_at, 'gemini-v1', now())
  on conflict (workspace_id) do update set extraction_json = excluded.extraction_json, source_document_ids = excluded.source_document_ids, status = excluded.status, consented_at = coalesce(academic_profiles.consented_at, excluded.consented_at), extraction_version = excluded.extraction_version, updated_at = now();

  delete from courses where workspace_id = p_workspace_id;
  delete from degree_requirements where workspace_id = p_workspace_id;

  insert into courses (workspace_id, code, name_th, credits, grade, term, year, source, verified_by_user)
  select p_workspace_id, x.code, x.name_th, x.credits, x.grade, x.term, x.year, 'transcript', false
  from jsonb_to_recordset(p_courses) as x(code text, name_th text, credits numeric, grade text, term text, year integer);

  insert into degree_requirements (workspace_id, category_name, requirement_type, required_course_code, required_course_name, minimum_credits, prerequisite_data, source, verified_by_user)
  select p_workspace_id, x.category_name, x.requirement_type::requirement_type, x.required_course_code, x.required_course_name, x.minimum_credits, '[]'::jsonb, 'curriculum', false
  from jsonb_to_recordset(p_requirements) as x(category_name text, requirement_type text, required_course_code text, required_course_name text, minimum_credits numeric);
end;
$$;
