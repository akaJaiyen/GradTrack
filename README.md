# GradTrack

Privacy-first curriculum tracker for students. Copy `.env.example` to `.env.local`, provision a private Supabase bucket named `private-documents`, and run the SQL migration before using persistence.

```powershell
npm install
npm run dev
```

The UI runs in demo mode without Supabase. For the unified academic-profile workflow, apply every migration in order through `0009_reset_confirmed_courses_on_reanalysis.sql` and add `TYPHOON_API_KEY` to `.env.local`. Uploaded academic PDFs and images are sent from the server to Typhoon only after the user has granted consent; the API key is never exposed to the browser.

## Transcript review policy

Users review and edit transcript courses by academic year and term. Their confirmed course rows are the source used for progress and GPA displays; the original AI/OCR profile remains stored separately for traceability. Starting a new analysis intentionally replaces the complete course set, so the new result must be reviewed and confirmed again.
