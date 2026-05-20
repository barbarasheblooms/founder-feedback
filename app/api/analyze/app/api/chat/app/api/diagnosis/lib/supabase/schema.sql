create table if not exists feedback_entries (
  id          uuid        default gen_random_uuid() primary key,
  created_at  timestamptz default now(),
  name        text        not null default 'Unnamed',
  source      text        not null default 'other',
  source_label text,
  added_by    text,
  analysis    jsonb,
  entry_date  text
);

alter publication supabase_realtime add table feedback_entries;

alter table feedback_entries enable row level security;

create policy "Team can read all entries"
  on feedback_entries for select using (true);

create policy "Team can insert entries"
  on feedback_entries for insert with check (true);

create policy "Team can delete entries"
  on feedback_entries for delete using (true);