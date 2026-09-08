-- Run MANUALLY as database owner, after migration 004. Fail closed.
begin;
do $$declare target constant uuid:='c1de65cb-9086-430f-8828-dbea316c6452';begin
 perform pg_advisory_xact_lock(738291);
 if (select count(*) from auth.users where lower(email)='bfe@nomios.fr')<>1
 or not exists(select 1 from auth.users a join public.users p on p.id=a.id where a.id=target and lower(a.email)='bfe@nomios.fr') then
 raise exception 'Activation annulée : identité email/UUID/profil non concordante.';end if;
 insert into private.player_access(user_id,is_admin,suspended) values(target,true,false) on conflict(user_id) do update set is_admin=true,suspended=false;
 insert into private.admin_audit(actor_id,action,target_id,reason) values(target,'bootstrap_admin',target::text,'Activation manuelle après double vérification email et UUID');
end$$;
commit;
