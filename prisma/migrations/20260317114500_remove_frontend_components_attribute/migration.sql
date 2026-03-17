-- Remove deprecated frontend.components from existing evaluation payloads
UPDATE "groups"
SET "evaluation" = "evaluation" #- '{frontend,components}'
WHERE jsonb_typeof("evaluation") = 'object'
  AND jsonb_typeof("evaluation"->'frontend') = 'object'
  AND ("evaluation"->'frontend') ? 'components';
