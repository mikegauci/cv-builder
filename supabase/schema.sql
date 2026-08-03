create table if not exists public.cvs (
  id bigint generated always as identity primary key,
  title text not null,
  slug text not null unique,
  target_role text not null,
  summary text,
  full_name text not null,
  profile_image_url text,
  email text,
  phone text,
  city text,
  country text,
  linkedin text,
  github text,
  website text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cv_entries (
  id bigint generated always as identity primary key,
  cv_id bigint not null references public.cvs(id) on delete cascade,
  section text not null check (
    section in ('experience', 'education', 'languages', 'skills', 'courses', 'projects', 'certifications')
  ),
  item_order int not null default 1,
  title text not null,
  subtitle text,
  date_label text,
  description text
);

create table if not exists public.cover_letters (
  id bigint generated always as identity primary key,
  cv_id bigint references public.cvs(id) on delete set null,
  slug text not null unique,
  role text not null,
  company_name text not null,
  body text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cvs_set_updated_at on public.cvs;
create trigger cvs_set_updated_at
before update on public.cvs
for each row
execute function public.set_updated_at();

drop trigger if exists cover_letters_set_updated_at on public.cover_letters;
create trigger cover_letters_set_updated_at
before update on public.cover_letters
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cv-profile-images',
  'cv-profile-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cv_profile_images_public_read'
  ) then
    create policy cv_profile_images_public_read
    on storage.objects
    for select
    to public
    using (bucket_id = 'cv-profile-images');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cv_profile_images_anon_insert'
  ) then
    create policy cv_profile_images_anon_insert
    on storage.objects
    for insert
    to anon
    with check (bucket_id = 'cv-profile-images');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cv_profile_images_anon_update'
  ) then
    create policy cv_profile_images_anon_update
    on storage.objects
    for update
    to anon
    using (bucket_id = 'cv-profile-images')
    with check (bucket_id = 'cv-profile-images');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cv_profile_images_anon_delete'
  ) then
    create policy cv_profile_images_anon_delete
    on storage.objects
    for delete
    to anon
    using (bucket_id = 'cv-profile-images');
  end if;
end $$;
