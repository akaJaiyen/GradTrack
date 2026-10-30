-- Store only a safe diagnostic code. Never persist provider error text, which
-- could contain document-derived content or other sensitive information.
alter table public.documents add column if not exists extraction_error text;

alter table public.documents add constraint documents_extraction_error_check
  check (extraction_error is null or extraction_error in (
    'gemini_configuration', 'gemini_authentication', 'gemini_model',
    'gemini_rate_limited', 'gemini_request', 'storage_download',
    'profile_save', 'unknown'
  ));
