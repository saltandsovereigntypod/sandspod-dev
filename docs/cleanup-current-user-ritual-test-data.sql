-- REVIEW IN DEVELOPMENT FIRST. Never run automatically.
-- Replace the UUID, preview, and change ROLLBACK to COMMIT only after review.
begin;
create temporary table ritual_cleanup_target(user_id uuid primary key) on commit drop;
insert into ritual_cleanup_target values ('00000000-0000-0000-0000-000000000000');

select 'ritual_templates' kind, count(*) from ritual_templates r join ritual_cleanup_target t using (user_id)
union all select 'ritual_sessions', count(*) from ritual_sessions r join ritual_cleanup_target t using (user_id)
union all select 'user_rituals', count(*) from user_rituals r join ritual_cleanup_target t using (user_id)
union all select 'ritual_links', count(*) from ritual_links r join ritual_cleanup_target t using (user_id)
union all select 'legacy ritual pages', count(*) from grimoire_pages r join ritual_cleanup_target t using (user_id)
  where page_type = 'ritual_journal'
union all select 'ritual Library entries', count(*) from living_library_entries r join ritual_cleanup_target t using (user_id)
  where type in ('ritual', 'ritual_template');

delete from ritual_links where user_id in (select user_id from ritual_cleanup_target);
delete from ritual_session_steps where user_id in (select user_id from ritual_cleanup_target);
delete from ritual_template_steps where user_id in (select user_id from ritual_cleanup_target);
delete from grimoire_page_links where user_id in (select user_id from ritual_cleanup_target)
  and page_id in (select id from grimoire_pages where user_id in (select user_id from ritual_cleanup_target) and page_type = 'ritual_journal');
delete from grimoire_blocks where user_id in (select user_id from ritual_cleanup_target)
  and page_id in (select id from grimoire_pages where user_id in (select user_id from ritual_cleanup_target) and page_type = 'ritual_journal');
delete from grimoire_pages where user_id in (select user_id from ritual_cleanup_target) and page_type = 'ritual_journal';
delete from library_relations where user_id in (select user_id from ritual_cleanup_target)
  and (from_entity_id like 'ritual:%' or from_entity_id like 'ritual-template:%' or to_entity_id like 'ritual:%' or to_entity_id like 'ritual-template:%');
delete from living_library_entries where user_id in (select user_id from ritual_cleanup_target)
  and (type in ('ritual', 'ritual_template') or entity_id like 'ritual:%' or entity_id like 'ritual-template:%');
delete from user_rituals where user_id in (select user_id from ritual_cleanup_target);
delete from ritual_sessions where user_id in (select user_id from ritual_cleanup_target);
delete from ritual_templates where user_id in (select user_id from ritual_cleanup_target);
delete from grimoire_sections s where s.user_id in (select user_id from ritual_cleanup_target)
  and s.title = 'Ritual Journal' and not exists (select 1 from grimoire_pages p where p.section_id = s.id);

-- Apothecary items, saved Altars, objects, traditional entries, and unrelated pages are never selected.
rollback;
