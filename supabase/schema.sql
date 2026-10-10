-- Run in Supabase SQL Editor. Replace the email at the bottom before running.
begin;
create table if not exists public.owner_accounts (email text primary key check (email = lower(email)));
alter table public.owner_accounts enable row level security;
revoke all on public.owner_accounts from anon, authenticated;
grant select on public.owner_accounts to authenticated;
drop policy if exists "owner sees own membership" on public.owner_accounts;
create policy "owner sees own membership" on public.owner_accounts for select to authenticated
using (email = lower(auth.jwt()->>'email'));

create table if not exists public.battle_documents (
 user_id uuid primary key references auth.users(id) on delete cascade,
 documents jsonb not null default '{}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 constraint valid_documents check (
   jsonb_typeof(documents) = 'object'
   and documents - 'matches' - 'profile' = '{}'::jsonb
   and (not (documents ? 'matches') or jsonb_typeof(documents->'matches') = 'string')
   and (not (documents ? 'profile') or jsonb_typeof(documents->'profile') = 'string')
   and octet_length(documents::text) <= 12000000
 )
);
alter table public.battle_documents enable row level security;
revoke all on public.battle_documents from anon, authenticated;
grant select, insert, update on public.battle_documents to authenticated;
drop policy if exists "private owner documents" on public.battle_documents;
create policy "private owner documents" on public.battle_documents for all to authenticated
using (user_id = (select auth.uid()) and exists(select 1 from public.owner_accounts where email = lower(auth.jwt()->>'email')))
with check (user_id = (select auth.uid()) and exists(select 1 from public.owner_accounts where email = lower(auth.jwt()->>'email')));

-- Every update increments revision, including direct table updates, so stale writes are detected.
create or replace function public.bump_battle_revision() returns trigger language plpgsql set search_path = '' as $$
begin
 new.revision := old.revision + 1;
 new.updated_at := now();
 return new;
end; $$;
drop trigger if exists battle_revision on public.battle_documents;
create trigger battle_revision before update on public.battle_documents for each row execute function public.bump_battle_revision();

create or replace function public.save_battle_documents(p_documents jsonb, p_expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if p_expected_revision = 0 then
   insert into public.battle_documents(user_id, documents) values(auth.uid(), p_documents)
   on conflict(user_id) do nothing returning revision into v_revision;
 else
   update public.battle_documents set documents=p_documents
   where user_id=auth.uid() and revision=p_expected_revision returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Revision conflict: reload the latest documents'; end if;
 return v_revision;
end; $$;
revoke all on function public.save_battle_documents(jsonb,bigint) from public, anon;
grant execute on function public.save_battle_documents(jsonb,bigint) to authenticated;

-- REQUIRED: replace with your Google account email. Do not put passwords here.
-- Run this separately after replacing the address:
-- insert into public.owner_accounts(email) values(lower('YOUR_GOOGLE_EMAIL')) on conflict do nothing;
commit;
