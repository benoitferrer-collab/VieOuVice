-- Lecture seule : exécuter dans SQL Editor après init.sql et seed.sql.
-- Ces contrôles propriétaire ne remplacent PAS scripts/test-remote.mjs.
do $$declare bad integer;begin
 select count(*) into bad from public.users u where u.life_balance<>coalesce((select sum(l.life_delta) from private.life_ledger l where l.user_id=u.id),0);
 if bad<>0 then raise exception 'Ledger/cache désynchronisés : %',bad;end if;
 select count(*) into bad from public.leaderboard_entries e where e.weekly_score<>coalesce((select sum(l.league_delta) from private.life_ledger l where l.user_id=e.user_id and l.season_id=e.season_id),0);
 if bad<>0 then raise exception 'Projection hebdomadaire incohérente : %',bad;end if;
 if exists(select league_id from public.league_memberships group by league_id having count(*)>30) then raise exception 'Capacité de ligue dépassée.';end if;
 if exists(select source_id from private.life_ledger where reason in('donation_sent','donation_received') group by source_id having sum(life_delta)<>0 or count(*)<>2 or sum(league_delta)<>0) then raise exception 'Don non conservatif.';end if;
 if has_table_privilege('authenticated','public.users','UPDATE') or has_table_privilege('authenticated','public.actions','INSERT') or has_table_privilege('authenticated','private.life_ledger','INSERT') then raise exception 'Privilèges de mutation excessifs.';end if;
 if has_function_privilege('anon','public.record_action(text,integer,uuid)','EXECUTE') then raise exception 'RPC accessible anonyme.';end if;
 if has_function_privilege('authenticated','private.ensure_season(timestamptz)','EXECUTE') then raise exception 'Job accessible joueur.';end if;
 if not has_function_privilege('authenticated','public.record_action(text,integer,uuid)','EXECUTE') or not has_function_privilege('authenticated','private.record_action(text,integer,uuid)','EXECUTE') then raise exception 'Wrapper/helper inaccessibles.';end if;
 if exists(select 1 from public.nemesis_pairs n where exists(select 1 from public.nemesis_pairs m where m.season_id=n.season_id and m.user_a<>n.user_a and(n.user_a=m.user_b or n.user_b=m.user_a))) then raise exception 'Némésis apparié deux fois.';end if;
 raise notice 'Invariants de lecture : OK';
end$$;
-- Bornes DST : 167 h au printemps, 169 h en automne.
do $$begin
 if extract(epoch from (timestamptz '2026-03-30 00:00 Europe/Paris'-timestamptz '2026-03-23 00:00 Europe/Paris'))/3600<>167 then raise exception 'DST printemps';end if;
 if extract(epoch from (timestamptz '2026-10-26 00:00 Europe/Paris'-timestamptz '2026-10-19 00:00 Europe/Paris'))/3600<>169 then raise exception 'DST automne';end if;
end$$;
-- Réconciliation détaillée (résultat attendu : zéro ligne).
select u.id,u.life_balance,coalesce(sum(l.life_delta),0) as ledger_total from public.users u left join private.life_ledger l on l.user_id=u.id group by u.id having u.life_balance<>coalesce(sum(l.life_delta),0);
