ALTER TABLE "modules"
RENAME COLUMN "clone_spec_use_cases" TO "team_spec_use_cases";

ALTER TABLE "modules"
RENAME COLUMN "clone_spec_workflows" TO "team_spec_workflows";

ALTER TABLE "modules"
RENAME COLUMN "clone_spec_rules" TO "team_spec_rules";

ALTER TABLE "modules"
RENAME COLUMN "clone_spec_layout" TO "team_spec_layout";
