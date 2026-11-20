-- One membership per person and organization. Two invitations accepted at the same moment
-- could insert a second row for the same pair. Keep the oldest row of each pair (its id and
-- join date) and give it the strongest role among the duplicates, so no organization loses
-- its owner. Roles are ranked the way src/lib/org-roles.ts parseOrgRole reads them.
WITH "duplicated" AS (
  SELECT "organizationId", "userId"
  FROM "member"
  GROUP BY "organizationId", "userId"
  HAVING COUNT(*) > 1
),
"graded" AS (
  SELECT
    m."id",
    m."organizationId",
    m."userId",
    m."role",
    m."createdAt",
    (
      SELECT COALESCE(MAX(CASE lower(trim("part"))
        WHEN 'owner' THEN 3
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 1
        WHEN 'viewer' THEN 0
      END), -1)
      FROM unnest(string_to_array(m."role", ',')) AS "part"
    ) AS "rank"
  FROM "member" AS m
  JOIN "duplicated" USING ("organizationId", "userId")
),
"ranked" AS (
  SELECT
    "graded".*,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "userId" ORDER BY "createdAt", "id"
    ) AS "age",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "userId" ORDER BY "rank" DESC, "createdAt", "id"
    ) AS "strength"
  FROM "graded"
)
UPDATE "member" AS m
SET "role" = "strongest"."role"
FROM "ranked" AS "oldest"
JOIN "ranked" AS "strongest"
  ON "strongest"."organizationId" = "oldest"."organizationId"
  AND "strongest"."userId" = "oldest"."userId"
  AND "strongest"."strength" = 1
WHERE m."id" = "oldest"."id"
  AND "oldest"."age" = 1
  AND m."role" <> "strongest"."role";

DELETE FROM "member" AS m
USING (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "userId" ORDER BY "createdAt", "id"
    ) AS "age"
  FROM "member"
) AS "ranked"
WHERE m."id" = "ranked"."id"
  AND "ranked"."age" > 1;

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");
