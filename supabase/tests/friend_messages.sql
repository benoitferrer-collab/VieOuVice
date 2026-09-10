-- Owner-only test fixtures. Always rollback; no network sends.
begin;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();d uuid:=gen_random_uuid();u uuid;owner_role text:=current_user;
 x jsonb;y jsonb;z jsonb;mid bigint;nid uuid;k uuid:=gen_random_uuid();failed boolean;subid uuid;cnt bigint;
begin
 insert into auth.users(id) values(a),(b),(c),(d);
 foreach u in array array[a,b,c,d] loop
 perform set_config('request.jwt.claim.sub',u::text,true);execute 'set local role authenticated';
 perform public.create_profile('msg_'||substr(replace(u::text,'-',''),1,14),0);
 execute format('set local role %I',owner_role);end loop;
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted'),(a,c,'pending');
 -- Delivery uses only an invalid test endpoint, no worker is invoked.
 insert into private.push_subscriptions(user_id,endpoint,p256dh,auth) values(b,'https://fcm.googleapis.com/fcm/send/test-messages-'||b,repeat('A',87),repeat('B',22)) returning id into subid;
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 x:=public.send_friend_message(b,' Bonjour <b>ami</b> ',k);
 y:=public.send_friend_message(b,'Bonjour <b>ami</b>',k);
 if x is distinct from y or x->>'body' is distinct from 'Bonjour <b>ami</b>' or jsonb_typeof(x->'id') is distinct from 'string' then raise exception 'Idempotence/body/string ID';end if;
 failed:=false;begin perform public.send_friend_message(b,'Autre',k);exception when others then failed:=true;end;if not failed then raise exception 'Retry changed';end if;
 failed:=false;begin perform public.send_friend_message(c,'Pending',gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Pending allowed';end if;
 failed:=false;begin perform public.send_friend_message(a,'Self',gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Self allowed';end if;
 failed:=false;begin perform public.send_friend_message(b,'  ',gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Blank allowed';end if;
 failed:=false;begin perform public.send_friend_message(b,repeat('x',2001),gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Long allowed';end if;
 execute format('set local role %I',owner_role);
 mid:=(x->>'id')::bigint;
 select id into nid from public.notifications where user_id=b and event_key='friend_message:'||mid;
 if nid is null or not private.push_notification_eligible(nid) or not exists(select 1 from private.push_outbox where notification_id=nid and subscription_id=subid) then raise exception 'Push not queued';end if;
 if exists(select 1 from public.notifications where id=nid and message like '%Bonjour%') then raise exception 'Message text leaked';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 x:=public.get_message_inbox();if (x->>'unread_count')::int is distinct from 1 then raise exception 'Unread inbox';end if;
 x:=public.get_friend_messages(a,null);if jsonb_array_length(x->'messages') is distinct from 1 then raise exception 'Recipient cannot read';end if;
 perform public.read_friend_messages(a,array[mid]);
 x:=public.get_message_inbox();if (x->>'unread_count')::int is distinct from 0 then raise exception 'Read inbox';end if;
 execute format('set local role %I',owner_role);if private.push_notification_eligible(nid) then raise exception 'Read notification still pushes';end if;
 perform set_config('request.jwt.claim.sub',d::text,true);execute 'set local role authenticated';
 failed:=false;begin perform public.get_friend_messages(a,null);exception when others then failed:=true;end;if not failed then raise exception 'Third party read';end if;
 failed:=false;begin perform public.read_friend_messages(a,array[mid]);exception when others then failed:=true;end;if not failed then raise exception 'Third party marking';end if;
 failed:=false;begin execute 'select * from private.friend_messages';exception when others then failed:=true;end;if not failed then raise exception 'Raw table readable';end if;
 execute format('set local role %I',owner_role);
 -- Pagination beyond 30 and exact marking do not consume older unseen messages.
 insert into private.friend_messages(sender_id,recipient_id,body,idempotency_key,created_at)
 select a,b,'history-'||g,gen_random_uuid(),clock_timestamp()-interval '2 hours' from generate_series(1,35)g;
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 x:=public.get_friend_messages(a,null);
 if jsonb_array_length(x->'messages') is distinct from 30 or x->'has_more' is distinct from 'true'::jsonb then raise exception 'First page';end if;
 y:=public.get_friend_messages(a,(x->'messages'->29->>'id')::bigint);
 if jsonb_array_length(y->'messages') is distinct from 6 or y->'has_more' is distinct from 'false'::jsonb then raise exception 'Second page';end if;
 perform public.read_friend_messages(a,array[(x->'messages'->0->>'id')::bigint]);
 z:=public.get_message_inbox();if (z->>'unread_count')::int is distinct from 34 then raise exception 'Unseen messages marked';end if;
 x:=public.export_my_data();if jsonb_array_length(x->'private_messages') is distinct from 36 then raise exception 'Export missing messages';end if;
 perform public.set_message_notifications(false);
 execute format('set local role %I',owner_role);
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 x:=public.send_friend_message(b,'Silent',gen_random_uuid());execute format('set local role %I',owner_role);
 if exists(select 1 from public.notifications where event_key='friend_message:'||(x->>'id')) then raise exception 'Optout ignored';end if;
 -- Re-enable does not replay earlier notifications.
 perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';perform public.set_message_notifications(true);execute format('set local role %I',owner_role);
 perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';x:=public.send_friend_message(b,'Later',gen_random_uuid());execute format('set local role %I',owner_role);
 select id into nid from public.notifications where event_key='friend_message:'||(x->>'id');
 insert into public.blocks(blocker,blocked) values(b,a);
 if private.push_notification_eligible(nid) or exists(select 1 from public.notifications where id=nid) then raise exception 'Blocked push retained';end if;
 execute 'set local role authenticated';failed:=false;begin perform public.send_friend_message(b,'Bonjour <b>ami</b>',k);exception when others then failed:=true;end;if not failed then raise exception 'Blocked retry allowed';end if;
 failed:=false;begin perform public.get_friend_messages(b,null);exception when others then failed:=true;end;if not failed then raise exception 'Blocked history allowed';end if;
 execute format('set local role %I',owner_role);delete from public.blocks where blocker=b and blocked=a;
 insert into private.player_access(user_id,suspended) values(b,true);
 execute 'set local role authenticated';failed:=false;begin perform public.send_friend_message(b,'Suspended',gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Suspended recipient allowed';end if;
 execute format('set local role %I',owner_role);
 -- Independent quota fixture, including idempotent retry at the cap.
 insert into public.friendships(requester,recipient,status) values(c,d,'accepted');
 insert into private.friend_messages(sender_id,recipient_id,body,idempotency_key) select c,d,'limit',gen_random_uuid() from generate_series(1,20);
 perform set_config('request.jwt.claim.sub',c::text,true);execute 'set local role authenticated';failed:=false;begin perform public.send_friend_message(d,'Over limit',gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Minute quota ignored';end if;
 execute format('set local role %I',owner_role);
 update private.friend_messages set created_at=private.day_start(clock_timestamp()) where sender_id=c;
 insert into private.friend_messages(sender_id,recipient_id,body,idempotency_key,created_at) select c,d,'daily limit',gen_random_uuid(),private.day_start(clock_timestamp()) from generate_series(1,180);
 execute 'set local role authenticated';failed:=false;begin perform public.send_friend_message(d,'Over day',gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'Daily quota ignored';end if;
 execute format('set local role %I',owner_role);
 if has_function_privilege('anon','public.send_friend_message(uuid,text,uuid)','EXECUTE') or has_function_privilege('authenticated','private.message_pair_allowed(uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','private.push_notification_eligible_before_messages(uuid)','EXECUTE') then raise exception 'Helper ACL';end if;
 raise notice 'Friend message assertions passed; rollback follows.';
end $test$;
rollback;
