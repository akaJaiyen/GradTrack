-- Preserve rate-limit failures separately so the UI can offer a retry after
-- the Gemini quota resets, without treating the uploaded file as corrupt.
alter type document_status add value if not exists 'rate_limited';
