-- Local/test database only. Fixtures roll back; no outbound messages.
begin;
do $test$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();message jsonb;mid bigint;inbox jsonb;
begin
 insert into auth.users(id) values(a),(b),(c);
 perform set_config('request.jwt.claim.sub',a::text,true);perform public.create_profile('qa_'||substr(replace(a::text,'-',''),1,14),0);
 perform set_config('request.jwt.claim.sub',b::text,true);perform public.create_profile('qa_'||substr(replace(b::text,'-',''),1,14),0);
 perform set_config('request.jwt.claim.sub',c::text,true);perform public.create_profile('qa_'||substr(replace(c::text,'-',''),1,14),0);
 insert into public.friendships(requester,recipient,status) values(a,b,'accepted'),(a,c,'accepted');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.send_friend_message(c,'Ancien message',gen_random_uuid());
 message:=public.send_friend_message(b,'Dernier <b>message</b>',gen_random_uuid());mid:=(message->>'id')::bigint;
 inbox:=public.get_message_inbox();
 if inbox->'conversations'->0->>'friend_id'<>b::text or inbox->'conversations'->0->'last_message'->>'body'<>'Dernier <b>message</b>' then raise exception 'Preview/order incorrect';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 message:=public.set_message_reaction(mid,'heart');
 if message->'reactions'->0->>'reaction'<>'heart' then raise exception 'Reaction missing';end if;
 perform public.set_message_reaction(mid,'heart');
 if (select count(*) from private.message_reaction_mutations where user_id=b)<>1 then raise exception 'Retry consumed quota';end if;
 message:=public.set_message_reaction(mid,'clap');
 if jsonb_array_length(message->'reactions')<>1 or message->'reactions'->0->>'reaction'<>'clap' then raise exception 'Replace incorrect';end if;
 message:=public.set_message_reaction(mid,null);
 if message->'reactions'<>'[]'::jsonb then raise exception 'Remove incorrect';end if;
 begin perform public.set_message_reaction(mid,'invalid');raise exception 'Invalid accepted';exception when others then if sqlerrm='Invalid accepted' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',c::text,true);
 begin perform public.set_message_reaction(mid,'heart');raise exception 'Third party accepted';exception when others then if sqlerrm='Third party accepted' then raise;end if;end;
 inbox:=public.get_message_inbox();
 if inbox::text like '%Dernier%' then raise exception 'Third party preview leaked';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 insert into private.message_reaction_mutations(user_id) select b from generate_series(1,20);
 begin perform public.set_message_reaction(mid,'heart');raise exception 'Quota ignored';exception when others then if sqlerrm='Quota ignored' then raise;end if;end;
 delete from private.message_reaction_mutations where user_id=b;
 update public.friendships set status='pending' where requester=a and recipient=b;
 begin perform public.set_message_reaction(mid,'heart');raise exception 'Former friend accepted';exception when others then if sqlerrm='Former friend accepted' then raise;end if;end;
 if has_table_privilege('authenticated','private.message_reactions','SELECT') or has_function_privilege('anon','public.set_message_reaction(bigint,text)','EXECUTE') or has_function_privilege('authenticated','private.get_message_inbox_before_previews()','EXECUTE') then raise exception 'Private API exposed';end if;
 raise notice 'Messaging improvements passed';
end $test$;
rollback;
