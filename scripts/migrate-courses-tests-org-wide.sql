-- =============================================================================
-- Method 1: Organization-wide courses & tests (NULL branchId)
-- =============================================================================
--
-- PREFERRED: run the TypeORM migration (handles all tables + correct column names):
--
--   yarn typeorm:migration:run
--
-- BEFORE RUNNING — avoid lock wait timeouts:
--   1. In MySQL Workbench: ROLLBACK any open transaction (from manual SQL).
--   2. Stop the NestJS dev server (`yarn start:dev`) if it is running.
--   3. Check blockers: SELECT * FROM information_schema.innodb_trx;
--
-- Migration file:
--   src/migrations/1741100000000-MakeActiveCoursesOrgWide.ts
--
-- Revert is not supported (data migration). Restore from backup if needed:
--   yarn typeorm:migration:revert
--
-- =============================================================================
-- Manual SQL below is kept for inspection / emergency use only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Inspect current branch distribution (read-only)
-- -----------------------------------------------------------------------------

SELECT
    c.branchIdId AS course_branch_id,
    b.name AS branch_name,
    b.alias AS branch_alias,
    COUNT(*) AS course_count
FROM courses c
LEFT JOIN branches b ON b.id = c.branchIdId
WHERE c.status = 'active'
GROUP BY c.branchIdId, b.name, b.alias
ORDER BY course_count DESC;

SELECT
    t.branchIdId AS test_branch_id,
    b.name AS branch_name,
    COUNT(*) AS test_count
FROM tests t
LEFT JOIN branches b ON b.id = t.branchIdId
WHERE t.isActive = 1
GROUP BY t.branchIdId, b.name
ORDER BY test_count DESC;

-- -----------------------------------------------------------------------------
-- STEP 2: Verify after migration (read-only)
-- -----------------------------------------------------------------------------

SELECT
    c.courseId,
    c.title,
    c.branchIdId AS course_branch_id,
    COUNT(DISTINCT t.testId) AS test_count,
    COUNT(DISTINCT q.questionId) AS question_count
FROM courses c
LEFT JOIN tests t ON t.courseId = c.courseId
LEFT JOIN questions q ON q.testId = t.testId
WHERE c.status = 'active'
GROUP BY c.courseId, c.title, c.branchIdId
ORDER BY c.courseId;

SELECT COUNT(*) AS org_wide_active_courses
FROM courses
WHERE status = 'active'
  AND branchIdId IS NULL;

SELECT COUNT(*) AS materials_still_branch_scoped
FROM course_materials cm
INNER JOIN courses c ON c.courseId = cm.courseId
WHERE c.status = 'active'
  AND c.branchIdId IS NULL
  AND cm.branchId IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Column reference
-- -----------------------------------------------------------------------------
-- courses, tests, questions, question_options  →  branchIdId
-- course_materials                             →  branchId  (NOT branchIdId)
