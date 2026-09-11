-- Défis volontaires de bonnes habitudes. Barèmes fictifs, aucune estimation médicale.
-- Appliquer une fois après 001–009. Aucune catégorie historique n'est reclassée.
begin;
select pg_advisory_xact_lock(738291);
insert into public.action_catalog(id,label,kind,unit,max_quantity,coefficient,daily_cap,icon) values
('beer','Bière','excess','bière déclarée',5,-20,0,'wine'),
('gin-cocktail','Cocktail au gin','excess','cocktail',5,-25,0,'wine'),
('sport-15','Activité sportive · 15 minutes','health','quart d’heure',4,20,80,'activity') on conflict(id) do nothing;
create table private.cooperative_challenges(
 id uuid primary key default gen_random_uuid(),creator_id uuid not null references public.users,
 template text not null check(template in('sport','walk','pause')),target integer not null check(target>0),
 created_at timestamptz not null default clock_timestamp(),ends_at timestamptz not null,
 status text not null default 'active' check(status in('active','completed','expired')),
 progress bigint not null default 0,participant_count integer not null default 1,contributor_count integer not null default 0,
 check(ends_at>created_at));
create unique index cooperative_one_created on private.cooperative_challenges(creator_id) where status='active';
create index cooperative_due on private.cooperative_challenges(ends_at) where status='active';
create table private.cooperative_members(
 challenge_id uuid not null references private.cooperative_challenges,user_id uuid not null references public.users,
 status text not null check(status in('invited','accepted','declined','left')),accepted_at timestamptz,
 progress bigint not null default 0,primary key(challenge_id,user_id));
create index cooperative_user on private.cooperative_members(user_id,status);
create table private.cooperative_requests(
 creator_id uuid not null references public.users,request_key uuid not null,payload jsonb not null,
 challenge_id uuid not null references private.cooperative_challenges,primary key(creator_id,request_key));
create table private.cooperative_badges(
 challenge_id uuid not null references private.cooperative_challenges,user_id uuid not null references public.users,
 awarded_at timestamptz not null default clock_timestamp(),primary key(challenge_id,user_id));
alter table private.cooperative_challenges enable row level security;
alter table private.cooperative_members enable row level security;
alter table private.cooperative_requests enable row level security;
alter table private.cooperative_badges enable row level security;
revoke all on private.cooperative_challenges,private.cooperative_members,private.cooperative_requests,private.cooperative_badges from public,anon,authenticated,service_role;

create function private.cooperative_member_allowed(p_id uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.cooperative_challenges c where c.id=p_id
 and not exists(select 1 from private.player_access p where p.user_id in(p_user,c.creator_id) and p.suspended)
 and not private.is_blocked(p_user,c.creator_id)
 and (p_user=c.creator_id or private.message_pair_allowed(p_user,c.creator_id))
 and not exists(select 1 from private.cooperative_members m where m.challenge_id=c.id and m.status in('accepted','invited') and private.is_blocked(p_user,m.user_id)))
$$;
create function private.refresh_cooperative_challenges() returns void
language plpgsql security definer set search_path='' as $$
declare c private.cooperative_challenges;t timestamptz:=clock_timestamp();begin
 perform pg_advisory_xact_lock(738291);
 -- One statement evaluates all invalid members against the same membership snapshot.
 update private.cooperative_members m set status='left',progress=0
 from private.cooperative_challenges q where q.id=m.challenge_id and q.status='active'
 and m.status in('accepted','invited') and not private.cooperative_member_allowed(q.id,m.user_id);
 for c in select * from private.cooperative_challenges where status='active' for update loop
 update private.cooperative_members m set progress=coalesce((
 select sum(d.value) from (
 select least(case c.template when 'pause' then 1 else 60 end,
 sum(case when c.template='sport' and a.catalog_id='sport-15' then a.quantity*15
 when c.template='walk' and a.catalog_id='walk' then a.quantity*20
 when c.template='walk' and a.catalog_id='brisk-walk' then a.quantity*30
 when c.template='pause' and a.catalog_id='pause' then a.quantity else 0 end)) value
 from public.actions a join public.action_catalog ac on ac.id=a.catalog_id
 where a.user_id=m.user_id and a.kind='health' and a.minutes_impact>0 and ac.kind='health' and ac.coefficient>0
 and a.created_at>=greatest(c.created_at,m.accepted_at) and a.created_at<least(c.ends_at,t)
 group by private.day_start(a.created_at)) d),0)
 where m.challenge_id=c.id and m.status='accepted';
 update private.cooperative_challenges set
 progress=(select coalesce(sum(progress),0) from private.cooperative_members where challenge_id=c.id and status='accepted'),
 participant_count=(select count(*) from private.cooperative_members where challenge_id=c.id and status='accepted'),
 contributor_count=(select count(*) from private.cooperative_members where challenge_id=c.id and status='accepted' and progress>0)
 where id=c.id returning * into c;
 if c.progress>=c.target and c.contributor_count>=2 then
 update private.cooperative_challenges set status='completed' where id=c.id;
 insert into private.cooperative_badges(challenge_id,user_id) select c.id,user_id from private.cooperative_members where challenge_id=c.id and status='accepted' and progress>0 on conflict do nothing;
 elsif c.ends_at<=t then update private.cooperative_challenges set status='expired' where id=c.id;end if;
 end loop;
end$$;
-- Settle at the event itself: later departure/block cannot erase an earned result.
create function private.cooperative_event_refresh() returns trigger
language plpgsql security definer set search_path='' as $$begin
 perform private.refresh_cooperative_challenges();return new;
end$$;
create trigger cooperative_after_action after insert on public.actions for each row execute function private.cooperative_event_refresh();
create trigger cooperative_after_block after insert on public.blocks for each row execute function private.cooperative_event_refresh();
create trigger cooperative_after_access after insert or update on private.player_access for each row execute function private.cooperative_event_refresh();
create function private.get_cooperative_hub() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();begin
 perform private.refresh_cooperative_challenges();
 return jsonb_build_object('challenges',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'creator_name',(select nickname from public.users where id=c.creator_id),'template',c.template,'title',case c.template when 'sport' then 'Bouger ensemble' when 'walk' then 'Marcher ensemble' else 'Faire une pause ensemble' end,
 'target',c.target,'unit',case c.template when 'pause' then 'pauses' else 'minutes' end,
 'progress',c.progress,'my_progress',m.progress,'status',c.status,'ends_at',c.ends_at,'member_status',m.status,
 'participant_count',c.participant_count,'contributor_count',c.contributor_count,
 'badge',exists(select 1 from private.cooperative_badges b where b.challenge_id=c.id and b.user_id=u)) order by c.created_at desc)
 from private.cooperative_challenges c join private.cooperative_members m on m.challenge_id=c.id and m.user_id=u
 where (m.status='accepted' or (m.status='invited' and c.status='active')) and private.cooperative_member_allowed(c.id,u)),'[]'::jsonb));
end$$;
create function private.create_cooperative_challenge(p_template text,p_friends uuid[],p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();friends uuid[];f uuid;r private.cooperative_requests;payload jsonb;cid uuid;t timestamptz;begin
 perform private.refresh_cooperative_challenges();
 if p_template is null or p_template not in('sport','walk','pause') or p_key is null or coalesce(cardinality(p_friends),0) not between 1 and 4 then raise exception 'Défi invalide.';end if;
 select array_agg(v order by v) into friends from (select distinct unnest(p_friends) v)s;
 if cardinality(friends)<>cardinality(p_friends) or array_position(friends,null) is not null then raise exception 'Invitations invalides.';end if;
 foreach f in array friends loop if not private.message_pair_allowed(u,f) then raise exception 'Amitié acceptée requise.';end if;end loop;
 -- Pairwise blocking must not disclose an already blocked member to an invitee.
 if exists(select 1 from unnest(friends)a cross join unnest(friends)b where private.is_blocked(a,b)) then raise exception 'Équipe indisponible.';end if;
 payload:=jsonb_build_object('template',p_template,'friends',friends);
 select * into r from private.cooperative_requests where creator_id=u and request_key=p_key;
 if found then if r.payload<>payload then raise exception 'Clé déjà utilisée.';end if;return r.challenge_id;end if;
 if exists(select 1 from private.cooperative_challenges where creator_id=u and status='active') then raise exception 'Un seul défi créé actif.';end if;
 foreach f in array friends loop
 if (select count(*) from private.cooperative_members m join private.cooperative_challenges c on c.id=m.challenge_id where m.user_id=f and m.status='invited' and c.status='active')>=10 then raise exception 'Trop d’invitations en attente.';end if;end loop;
 t:=clock_timestamp();
 insert into private.cooperative_challenges(creator_id,template,target,created_at,ends_at) values(u,p_template,case p_template when 'sport' then 180 when 'walk' then 200 else 10 end,t,t+make_interval(secs=>604800)) returning id into cid;
 insert into private.cooperative_members(challenge_id,user_id,status,accepted_at) values(cid,u,'accepted',t);
 insert into private.cooperative_members(challenge_id,user_id,status) select cid,unnest(friends),'invited';
 insert into private.cooperative_requests values(u,p_key,payload,cid);return cid;
end$$;
create function private.respond_cooperative_challenge(p_id uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.assert_user();m private.cooperative_members;c private.cooperative_challenges;begin
 perform private.refresh_cooperative_challenges();
 if p_accept is null then raise exception 'Consentement requis.';end if;
 select * into m from private.cooperative_members where challenge_id=p_id and user_id=u;
 if not found or not private.cooperative_member_allowed(p_id,u) then raise exception 'Invitation indisponible.';end if;
 if (m.status='accepted' and p_accept) or (m.status='declined' and not p_accept) then return;end if;
 select * into c from private.cooperative_challenges where id=p_id;
 if m.status<>'invited' or c.status<>'active' then raise exception 'Invitation terminée.';end if;
 update private.cooperative_members set status=case when p_accept then 'accepted' else 'declined' end,accepted_at=case when p_accept then clock_timestamp() end where challenge_id=p_id and user_id=u;
end$$;
create function private.leave_cooperative_challenge(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform private.refresh_cooperative_challenges();
 if not exists(select 1 from private.cooperative_members where challenge_id=p_id and user_id=u) then raise exception 'Défi indisponible.';end if;
 update private.cooperative_members m set status='left',progress=0 from private.cooperative_challenges c where c.id=p_id and m.challenge_id=c.id and m.user_id=u and c.status='active' and m.status in('invited','accepted');
 perform private.refresh_cooperative_challenges();
end$$;
create function private.get_consumption_summary(p_days integer default 7) returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 if p_days is null or p_days not in(7,30) then raise exception 'Période invalide.';end if;
 return jsonb_build_object('days',p_days,'items',coalesce((select jsonb_agg(to_jsonb(s) order by s.catalog_id) from (
 select a.catalog_id,c.label,c.unit,sum(a.quantity)::bigint quantity from public.actions a join public.action_catalog c on c.id=a.catalog_id
 where a.user_id=u and a.created_at>=clock_timestamp()-make_interval(secs=>p_days*86400) and a.created_at<=clock_timestamp()
 and a.kind='excess' and a.catalog_id in('beer','gin-cocktail','cocktail-light','cocktail-strong','sweet-cocktail','spirit-shot','standard-drink','drink') group by a.catalog_id,c.label,c.unit)s),'[]'::jsonb));
end$$;
alter function private.public_progression_badges(uuid) rename to public_progression_badges_before_cooperative;
create function private.public_progression_badges(p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select private.public_progression_badges_before_cooperative(p_user)||coalesce((select jsonb_agg(jsonb_build_object('id','coop:'||b.challenge_id,'label','Ensemble, on avance','icon','medal') order by b.awarded_at desc) from private.cooperative_badges b where b.user_id=p_user),'[]'::jsonb)
$$;
alter function private.export_my_data() rename to export_my_data_before_cooperative;
create function private.export_my_data() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid:=private.assert_user();begin
 perform private.refresh_cooperative_challenges();
 return private.export_my_data_before_cooperative()||jsonb_build_object('cooperative_memberships',coalesce((select jsonb_agg(to_jsonb(m)) from private.cooperative_members m where user_id=u),'[]'::jsonb),'cooperative_badges',coalesce((select jsonb_agg(to_jsonb(b)) from private.cooperative_badges b where user_id=u),'[]'::jsonb));
end$$;
create function public.get_cooperative_hub() returns jsonb language sql security invoker set search_path='' as $$select private.get_cooperative_hub()$$;
create function public.create_cooperative_challenge(p_template text,p_friends uuid[],p_key uuid) returns uuid language sql security invoker set search_path='' as $$select private.create_cooperative_challenge(p_template,p_friends,p_key)$$;
create function public.respond_cooperative_challenge(p_id uuid,p_accept boolean) returns void language sql security invoker set search_path='' as $$select private.respond_cooperative_challenge(p_id,p_accept)$$;
create function public.leave_cooperative_challenge(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.leave_cooperative_challenge(p_id)$$;
create function public.get_consumption_summary(p_days integer default 7) returns jsonb language sql security invoker set search_path='' as $$select private.get_consumption_summary(p_days)$$;
create or replace function public.export_my_data() returns jsonb language sql security invoker set search_path='' as $$select private.export_my_data()$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('private','public') and p.proname=any(array['cooperative_event_refresh','cooperative_member_allowed','refresh_cooperative_challenges','get_cooperative_hub','create_cooperative_challenge','respond_cooperative_challenge','leave_cooperative_challenge','get_consumption_summary','public_progression_badges','public_progression_badges_before_cooperative','export_my_data','export_my_data_before_cooperative']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 if f.proname in('get_cooperative_hub','create_cooperative_challenge','respond_cooperative_challenge','leave_cooperative_challenge','get_consumption_summary','export_my_data') then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end$$;
commit;
