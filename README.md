# GradTrack

Privacy-first curriculum tracker for students. Copy `.env.example` to `.env.local`, provision a private Supabase bucket named `private-documents`, and run the SQL migration before using persistence.

```powershell
npm install
npm run dev
```

The UI runs in demo mode without Supabase. OCR is local-first: text PDFs are read with PDF.js; images use Tesseract.js in the browser. Users must review extracted data before confirming it.
