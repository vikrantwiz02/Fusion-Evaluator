-- AlterTable
ALTER TABLE "modules"
ADD COLUMN "spec_use_cases" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "spec_workflows" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "spec_rules" JSONB NOT NULL DEFAULT '[]';
