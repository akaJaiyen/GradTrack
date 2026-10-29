# GradTrack

Privacy-first curriculum tracker for students. Copy `.env.example` to `.env.local`, provision a private Supabase bucket named `private-documents`, and run the SQL migration before using persistence.

```powershell
npm install
npm run dev
```

The UI runs in demo mode without Supabase. For the unified academic-profile workflow, apply migrations through `0003_academic_profiles.sql` and add `GEMINI_API_KEY` to `.env.local`. Uploaded academic PDFs and images are sent from the server to Gemini only after the user has granted consent; the API key is never exposed to the browser.
