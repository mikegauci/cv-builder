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
- `OPENAI_MODEL` (optional, defaults to `gpt-6-astra`)

## 2) Supabase tables

Run SQL from `supabase/schema.sql` in your Supabase SQL editor.

For local development, keep RLS disabled on `cvs`, `cv_entries`, and `skill_pool` unless you also add auth policies.

## 3) Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## JD-tailored CV generation

1. Go to `/admin/skills` and seed your skills pool (import from existing CVs, bulk paste, or add manually).
2. Go to `/admin/cvs`, paste a job description, optionally add a company name, and click **Generate from job description**.
3. The generator runs two OpenAI steps: JD analysis, then CV tailoring using your skills pool and existing CVs.
4. Review the draft in the editor. Check the **JD Match** panel for strong/partial/missing coverage before publishing.

Generated CVs store the company name, job description, JD analysis, and coverage report for later review.

Slug collisions use numeric suffixes only (`-2`, `-3`), never `-tailored`.

On Vercel Hobby, function timeout is 60s — generation may fail if both OpenAI calls exceed that. Use Pro or set `maxDuration` lower with a single-stage fallback.

## Main routes

- `/` public CV list
- `/cv/[slug]` public CV page + PDF download
- `/admin/login` admin login
- `/admin` admin dashboard
- `/admin/cvs` CV list + create, PDF import, and generate from a job description
- `/admin/cvs/[id]` CV editor (includes JD match coverage for generated CVs)
- `/admin/skills` skills pool used by JD-tailored CV generation
