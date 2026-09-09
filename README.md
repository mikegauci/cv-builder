# CV Builder

Multi-CV builder with:

- Next.js + TypeScript + TailwindCSS
- Supabase database
- Admin dashboard for easy editing
- Multiple CV versions for different roles
- PDF download from the CV page

## 1) Setup

Create an env file from `.env.example`:

```bash
cp .env.example .env.local
```

Add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_PASSWORD`
- `OPENAI_API_KEY` (required to generate a tailored CV from a job description)

## 2) Supabase tables

Run SQL from `supabase/schema.sql` in your Supabase SQL editor.

For local development, keep RLS disabled on `cvs` and `cv_entries` unless you also add auth policies.

## 3) Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Main routes

- `/` public CV list
- `/cv/[slug]` public CV page + PDF download
- `/admin/login` admin login
- `/admin` admin dashboard
- `/admin/cvs` CV list + create, PDF import, and generate from a job description
- `/admin/cvs/[id]` CV editor
