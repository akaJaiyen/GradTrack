-- Consent belongs to the anonymous workspace, so it remains valid for all
-- document uploads during the workspace's 30-day lifetime.
alter table public.workspaces add column if not exists consented_at timestamptz;
