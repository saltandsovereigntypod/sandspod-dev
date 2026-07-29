-- Review in development first. Do not run until duplicate rows have been audited.
-- These indexes support retry-safe journal and relationship writes; they do not
-- alter RLS or expose credentials.

CREATE UNIQUE INDEX IF NOT EXISTS user_rituals_one_session_journal
  ON public.user_rituals (user_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ritual_links_identity
  ON public.ritual_links (
    user_id,
    ritual_id,
    link_type,
    COALESCE(entity_id::text, ''),
    COALESCE(object_instance_id::text, ''),
    COALESCE(apothecary_item_id::text, ''),
    COALESCE(grimoire_page_id::text, ''),
    COALESCE(saved_altar_id::text, '')
  );
