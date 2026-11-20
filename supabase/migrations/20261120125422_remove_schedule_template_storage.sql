-- The weekly schedule template UI was removed because the product direction is
-- automated day-off generation, not recurring manual schedule templates.
-- Production was checked before this migration: this table contained zero rows.
-- Keep organization_weekly_schedule_revisions; it is still required for confirmed
-- schedule change audit records and employee in-app notices.

DROP FUNCTION IF EXISTS public.delete_my_organization_schedule_template(uuid);
DROP FUNCTION IF EXISTS public.get_my_organization_schedule_template(uuid);
DROP FUNCTION IF EXISTS public.list_my_organization_schedule_templates(text);
DROP FUNCTION IF EXISTS public.save_my_organization_schedule_template(
    text, text, text, date, jsonb, jsonb, jsonb
);

DROP TABLE IF EXISTS public.organization_weekly_schedule_templates;
