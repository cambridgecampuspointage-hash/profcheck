create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  provider text not null,
  model text not null,
  reference_type text null,
  reference_id text null,
  prompt_summary text null,
  response_text text not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_generations_feature_idx on public.ai_generations(feature);
create index if not exists ai_generations_reference_idx on public.ai_generations(reference_type, reference_id);
create index if not exists ai_generations_created_at_idx on public.ai_generations(created_at desc);

alter table public.ai_generations enable row level security;

drop policy if exists "Admins can manage ai_generations" on public.ai_generations;
create policy "Admins can manage ai_generations"
on public.ai_generations
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
