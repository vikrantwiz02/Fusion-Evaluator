ALTER TABLE "modules"
ADD COLUMN "assigned_teams" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "team_access_start" TIMESTAMP(3),
ADD COLUMN "team_access_end" TIMESTAMP(3);
