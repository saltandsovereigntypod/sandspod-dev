-- DEVELOPMENT REVIEW TEMPLATE. It intentionally performs no UPDATE or DELETE.
-- Replace the UUID token, inspect every result, and keep ROLLBACK until a reviewed
-- server-side transaction is implemented for the deployed schema.
BEGIN;

WITH target AS (SELECT 'REPLACE_WITH_TARGET_USER_UUID'::uuid AS user_id)
SELECT count(*) AS owned_library_rows FROM living_library_entries e JOIN target t ON e.user_id = t.user_id;

WITH target AS (SELECT 'REPLACE_WITH_TARGET_USER_UUID'::uuid AS user_id)
SELECT e.entity_id,
       (SELECT count(*) FROM object_instances i WHERE i.user_id = t.user_id AND i.entity_id = e.entity_id) AS object_instances,
       (SELECT count(*) FROM library_relations r WHERE r.user_id = t.user_id AND (r.from_entity_id = e.entity_id OR r.to_entity_id = e.entity_id)) AS relations,
       (SELECT count(*) FROM ritual_links l WHERE l.user_id = t.user_id AND l.entity_id = e.entity_id) AS ritual_links
FROM living_library_entries e JOIN target t ON e.user_id = t.user_id
ORDER BY e.entity_id;

-- Required future order inside a verified transaction:
-- 1. lock/recalculate strong candidate groups; stop on authored conflicts;
-- 2. redirect directional relations, preventing self-relations;
-- 3. redirect object_instances.entity_id without merging instances/events;
-- 4. redirect ritual, Grimoire, Apothecary, and Altar references;
-- 5. remove exact duplicate relations; 6. retire proven duplicate entries;
-- 7. verify counts/dangling references and only then replace ROLLBACK with COMMIT.
ROLLBACK;
