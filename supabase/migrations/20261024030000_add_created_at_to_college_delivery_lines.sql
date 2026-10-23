alter table public.college_delivery_lines
  add column if not exists created_at timestamptz not null default now();
