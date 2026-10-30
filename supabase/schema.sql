-- Run only on a NEW project. Existing databases: make and verify a backup first.
-- No destructive statements. Tenant membership is managed only by the database administrator.
begin;
create table public.workspaces(id uuid primary key default gen_random_uuid(),name text not null);
create table public.members(workspace_id uuid not null references public.workspaces(id),user_id uuid not null references auth.users(id),display_name text not null,primary key(workspace_id,user_id),unique(user_id));
create table public.events(id uuid primary key,workspace_id uuid not null references public.workspaces(id),actor uuid not null references auth.users(id),payload jsonb not null,received_at timestamptz not null default now());
create index events_workspace on public.events(workspace_id,id);
create table public.backups(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),created_at timestamptz not null default now(),payload jsonb not null check(payload->>'version'='1' and payload ? 'ciphertext' and payload ? 'iv' and payload ? 'salt'));
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.backups enable row level security;
create policy own_membership on public.members for select to authenticated using(user_id=auth.uid());
create policy workspace_read on public.workspaces for select to authenticated using(exists(select 1 from public.members m where m.workspace_id=id and m.user_id=auth.uid()));
create policy event_read on public.events for select to authenticated using(exists(select 1 from public.members m where m.workspace_id=events.workspace_id and m.user_id=auth.uid()));
create policy backup_read on public.backups for select to authenticated using(exists(select 1 from public.members m where m.workspace_id=backups.workspace_id and m.user_id=auth.uid()));
create policy backup_write on public.backups for insert to authenticated with check(exists(select 1 from public.members m where m.workspace_id=backups.workspace_id and m.user_id=auth.uid()));
-- No UPDATE/DELETE policies. Only the RPC below may append to the ledger.
revoke all on public.workspaces,public.members,public.events,public.backups from anon,authenticated;
grant select on public.workspaces,public.members,public.events,public.backups to authenticated;
grant insert on public.backups to authenticated;

create function public.validate_event(e jsonb) returns void language plpgsql set search_path='' as $$
declare d jsonb:=e->'data'; n numeric; p jsonb; total_paid numeric:=0; total_schedule numeric:=0; field_name text;
begin
 if jsonb_typeof(e)<>'object' or not(e ?& array['id','entity','kind','parents','actor','actorName','at','data']) or e->>'kind' not in ('transaction','job','stock','staff','category') or jsonb_typeof(d)<>'object' or jsonb_typeof(e->'parents')<>'array' then raise exception 'Invalid event envelope';end if;
 perform (e->>'id')::uuid,(e->>'entity')::uuid,(e->>'actor')::uuid,(e->>'at')::timestamptz;
 foreach field_name in array array['name','customer','description','category','party','note','method','role','phone','start','end','lastReason','original'] loop
 if d ? field_name and (jsonb_typeof(d->field_name) is distinct from 'string' or length(d->>field_name)>4000) then raise exception 'Invalid text field';end if;
 end loop;
 foreach field_name in array array['cancelled','active'] loop
 if d ? field_name and jsonb_typeof(d->field_name) is distinct from 'boolean' then raise exception 'Invalid record status';end if;
 end loop;
 if e->>'kind'='staff' then
 if coalesce(d->>'start','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid staff date';end if;
 perform (d->>'start')::date;
 if coalesce(d->>'end','')<>'' then perform (d->>'end')::date;if (d->>'end')::date<(d->>'start')::date then raise exception 'Invalid staff date';end if;end if;
 end if;

 if e->>'kind'='transaction' then
 n:=(d->>'amount')::numeric;
 if n is null or n<=0 or n>10000000000000 or n<>trunc(n) or coalesce(d->>'type','') not in ('income','expense','opening','capital','withdrawal') or coalesce(d->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid cash movement';end if;
 perform (d->>'date')::date;
 elsif e->>'kind'='job' then
 if jsonb_typeof(d->'payments') is distinct from 'array' or jsonb_typeof(d->'schedule') is distinct from 'array' then raise exception 'Invalid installments';end if;
 n:=(d->>'total')::numeric;
 if n is null or n<=0 or n>10000000000000 or n<>trunc(n) or (d->>'deposit') is null or (d->>'deposit')::numeric<0 or (d->>'deposit')::numeric>n or (d->>'deposit')::numeric<>trunc((d->>'deposit')::numeric) then raise exception 'Invalid total';end if;
 for p in select value from jsonb_array_elements(d->'payments') loop
 if (p->>'amount') is null or (p->>'amount')::numeric<=0 or (p->>'amount')::numeric<>trunc((p->>'amount')::numeric) or (p->>'actor') is null or (p->>'id') is null or coalesce(p->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid payment';end if;
 perform (p->>'actor')::uuid,(p->>'id')::uuid,(p->>'date')::date;
 total_paid:=total_paid+(p->>'amount')::numeric;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(d->'payments')) then raise exception 'Duplicate payment';end if;
 for p in select value from jsonb_array_elements(d->'schedule') loop
 if (p->>'amount') is null or (p->>'amount')::numeric<0 or (p->>'amount')::numeric<>trunc((p->>'amount')::numeric) or coalesce(p->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid installment';end if;
 perform (p->>'date')::date;
 total_schedule:=total_schedule+(p->>'amount')::numeric;
 end loop;
 if total_paid>n or total_schedule<>n-(d->>'deposit')::numeric then raise exception 'Unbalanced job';end if;
 elsif e->>'kind'='stock' then
 if coalesce(d->>'unit','') not in ('Adet','Metre') or (d->>'quantity') is null or (d->>'quantity')::numeric<0 then raise exception 'Invalid stock';end if;
 end if;
 if e->>'kind' in ('stock','staff','category') and length(trim(coalesce(d->>'name','')))=0 then raise exception 'Name required';end if;
end $$;
revoke all on function public.validate_event(jsonb) from public;

create function public.append_events(p_workspace uuid,p_events jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e jsonb; old public.events; parent_id text; parent public.events; display text;
begin
 select display_name into display from public.members where workspace_id=p_workspace and user_id=auth.uid();
 if display is null then raise exception 'Access denied';end if;
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>10000 then raise exception 'Invalid batch';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace::text,0));
 -- Parents are checked after the whole batch is inserted: offline chains may arrive unordered.
 for e in select value from jsonb_array_elements(p_events) loop
 perform public.validate_event(e);
 select * into old from public.events where id=(e->>'id')::uuid;
 if found then
 if old.workspace_id<>p_workspace or old.payload<>e then raise exception 'ID collision';end if;
 else
 if e->>'actor'<>auth.uid()::text or e->>'actorName'<>display then raise exception 'Actor mismatch';end if;
 insert into public.events(id,workspace_id,actor,payload) values((e->>'id')::uuid,p_workspace,auth.uid(),e);
 end if;
 end loop;
 for e in select value from jsonb_array_elements(p_events) loop
 for parent_id in select jsonb_array_elements_text(e->'parents') loop
 select * into parent from public.events where id=parent_id::uuid;
 if not found or parent.workspace_id<>p_workspace or parent.payload->>'entity'<>e->>'entity' or parent.payload->>'kind'<>e->>'kind' or parent_id=e->>'id' then raise exception 'Invalid event ancestry';end if;
 end loop;
 end loop;
 -- Detect cycles in the submitted ancestry.
 if exists(with recursive chain(root,id,path,cycle) as (
 select value->>'id',value->>'id',array[value->>'id'],false from jsonb_array_elements(p_events)
 union all
 select c.root,p.value,c.path||p.value,p.value=any(c.path) from chain c join public.events ev on ev.id::text=c.id cross join lateral jsonb_array_elements_text(ev.payload->'parents') p(value) where not c.cycle and ev.workspace_id=p_workspace
 ) select 1 from chain where cycle) then raise exception 'Cyclic event ancestry';end if;
end $$;
revoke all on function public.append_events(uuid,jsonb) from public,anon;
grant execute on function public.append_events(uuid,jsonb) to authenticated;
create function public.read_ledger(p_workspace uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(payload order by id),'[]'::jsonb) from public.events where workspace_id=p_workspace;
$$;
revoke all on function public.read_ledger(uuid) from public,anon;
grant execute on function public.read_ledger(uuid) to authenticated,service_role;
grant select on public.workspaces,public.events to service_role;
grant insert on public.backups to service_role;
commit;
