-- WRITE-FREE Living Library duplicate audit.
-- Replace the token deliberately. Leaving it unchanged causes a UUID error.
WITH target AS (
  SELECT 'REPLACE_WITH_TARGET_USER_UUID'::uuid AS user_id
), entries AS (
  SELECT e.user_id, e.entity_id, e.type,
         COALESCE(e.my_practice->>'RitualTemplateId', e.my_practice->>'ritualTemplateId', e.my_practice->>'RitualId', e.my_practice->>'ritualId', e.my_practice->>'ApothecaryItemId', e.my_practice->>'apothecaryItemId') AS strong_source_id
  FROM living_library_entries e JOIN target t ON e.user_id = t.user_id
)
SELECT type, strong_source_id, count(*) AS candidate_count
FROM entries WHERE strong_source_id IS NOT NULL
GROUP BY type, strong_source_id HAVING count(*) > 1
ORDER BY candidate_count DESC;

WITH target AS (SELECT 'REPLACE_WITH_TARGET_USER_UUID'::uuid AS user_id)
SELECT from_entity_id, relation, to_entity_id, metadata, count(*) AS duplicate_count
FROM library_relations r JOIN target t ON r.user_id = t.user_id
GROUP BY from_entity_id, relation, to_entity_id, metadata HAVING count(*) > 1;

-- Weak evidence only: never an automatic merge instruction.
WITH target AS (SELECT 'REPLACE_WITH_TARGET_USER_UUID'::uuid AS user_id)
SELECT lower(type) AS type, lower(trim(name)) AS normalized_name, count(*) AS similar_name_count
FROM living_library_entries e JOIN target t ON e.user_id = t.user_id
GROUP BY lower(type), lower(trim(name)) HAVING count(*) > 1;
