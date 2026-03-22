ALTER TABLE "modules"
ADD COLUMN "clone_spec_use_cases" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "clone_spec_workflows" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "clone_spec_rules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "clone_spec_layout" JSONB NOT NULL DEFAULT '{}';
