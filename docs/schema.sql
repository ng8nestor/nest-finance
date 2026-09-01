create table credit_cards (
  id            uuid primary key default gen_random_uuid(),
  -- Filled by the database, never by the client. auth.uid() reads the user id
  -- out of the JWT on the request, so the value written is produced by the same
  -- call the four policies below check against — and a browser has no way to
  -- name a different owner. See the long note in src/lib/cards.js.
  user_id       uuid not null default auth.uid()
                references auth.users(id) on delete cascade,
  name          text not null,
  issuer        text,
  balance       numeric(12,2) not null check (balance >= 0),
  apr_pct       numeric(6,3)  not null check (apr_pct >= 0 and apr_pct < 100),
  credit_limit  numeric(12,2) not null check (credit_limit > 0),
  min_due       numeric(12,2) not null check (min_due >= 0),
  due_date      date,
  created_at    timestamptz not null default now()
);

alter table credit_cards enable row level security;

create policy "own cards - select" on credit_cards
  for select using (auth.uid() = user_id);

create policy "own cards - insert" on credit_cards
  for insert with check (auth.uid() = user_id);

create policy "own cards - update" on credit_cards
  for update using (auth.uid() = user_id);

create policy "own cards - delete" on credit_cards
  for delete using (auth.uid() = user_id);

create index credit_cards_user_id_idx on credit_cards (user_id);