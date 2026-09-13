-- Isolated local database only, after 001–017. No network; all fixtures rollback.
begin;
create function pg_temp.emoji_must_fail(command text) returns void language plpgsql as $$declare failed boolean:=false;begin
 begin execute command;exception when others then failed:=true;end;
 if not failed then raise exception 'Expected failure: %',command;end if;
end$$;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();u uuid;owner_name text:=current_user;
 eid uuid:=gen_random_uuid();message_key uuid:=gen_random_uuid();recipe jsonb:='{"face":"cat","color":"mint","expression":"wink","accessory":"crown"}';r jsonb;sent jsonb;mid bigint;nick text;i int;
begin
 foreach u in array array[a,b,c] loop
  insert into auth.users(id) values(u);perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.create_profile('emo_'||substr(replace(u::text,'-',''),1,14),0);
 end loop;
 insert into private.player_access values(a,true,false),(b,true,false);
 insert into public.friendships(requester,recipient,status) values(b,c,'accepted');
 if has_function_privilege('authenticated','public.reserve_ai_emoji(uuid,uuid,text)','execute') or has_function_privilege('authenticated','private.send_friend_message_before_emojis(uuid,text,uuid)','execute') or has_table_privilege('authenticated','private.emoji_catalog','select') or has_function_privilege('anon','public.send_friend_emoji(uuid,uuid,uuid)','execute') then raise exception 'Unsafe emoji ACL';end if;
 perform pg_temp.emoji_must_fail(format('select public.reserve_ai_emoji(%L,%L,''joie'')',c,eid));
 r:=public.reserve_ai_emoji(b,eid,'joie');if not (r->>'claimed')::boolean then raise exception 'Not reserved';end if;
 if (public.reserve_ai_emoji(b,eid,'joie')->>'claimed')::boolean then raise exception 'Duplicate generation';end if;
 perform pg_temp.emoji_must_fail(format('select public.reserve_ai_emoji(%L,%L,''calme'')',b,eid));
 perform pg_temp.emoji_must_fail(format('select public.finish_ai_emoji(%L,%L,''ai'',%L)',b,eid,(recipe||'{"svg":"<script/>"}')::text));
 perform public.finish_ai_emoji(b,eid,'ai',recipe);
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform pg_temp.emoji_must_fail(format('select public.admin_publish_emoji(%L)',eid));
 if jsonb_array_length(public.get_emoji_catalog())<>0 then raise exception 'Unpublished recipe visible';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 execute 'set local role authenticated';
 perform public.admin_publish_emoji(eid);
 sent:=public.send_friend_emoji(c,eid,message_key);mid:=(sent->>'id')::bigint;
 if sent->'emoji_snapshot'<>recipe then raise exception 'Snapshot missing';end if;
 if public.send_friend_emoji(c,eid,message_key)->>'id'<>mid::text then raise exception 'Replay duplicated';end if;
 perform public.admin_archive_emoji(eid);
 -- Retired stickers remain replayable and existing messages keep their recipe.
 if public.send_friend_emoji(c,eid,message_key)->'emoji_snapshot'<>recipe then raise exception 'Retirement erased message';end if;
 execute format('set local role %I',owner_name);
 perform pg_temp.emoji_must_fail(format('select public.send_friend_emoji(%L,%L,%L)',c,eid,gen_random_uuid()));
 perform pg_temp.emoji_must_fail(format('select public.send_friend_message(%L,''Emoji : joie'',%L)',c,message_key));
 perform public.admin_publish_emoji(eid);
 for i in 1..19 loop perform public.send_friend_message(c,'Test',gen_random_uuid());end loop;
 perform pg_temp.emoji_must_fail(format('select public.send_friend_emoji(%L,%L,%L)',c,eid,gen_random_uuid()));
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform pg_temp.emoji_must_fail(format('select public.send_friend_emoji(%L,%L,%L)',c,eid,gen_random_uuid()));
 -- Generation quota remains after account anonymization; no reset through delete.
 select nickname into nick from public.users where id=b;
 perform public.prepare_admin_account_deletion(a,b,nick);delete from auth.users where id=b;
 if not exists(select 1 from private.emoji_generations where id=eid and actor_id is null) or not exists(select 1 from private.emoji_catalog where id=eid and creator_id is null) then raise exception 'Emoji author not anonymized';end if;
 if exists(select 1 from private.friend_messages where id=mid) then raise exception 'Deleted account sticker remains';end if;
 update private.emoji_generations set created_at=clock_timestamp()-interval '1 minute' where id=eid;
 insert into private.emoji_generations(id,actor_id,theme,created_at) select gen_random_uuid(),a,'joie',clock_timestamp()-interval '1 minute' from generate_series(1,9);
 perform pg_temp.emoji_must_fail(format('select public.reserve_ai_emoji(%L,%L,''joie'')',a,gen_random_uuid()));
 raise notice 'Emojis: ACL, publish/archive, snapshots, replay, shared quotas, friend restriction and account cleanup passed';
end $test$;
rollback;
