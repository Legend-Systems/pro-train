-- Migrate legacy `brandon` role to `master_admin` (display label: Master Admin).
-- Run against the ProTrain database before deploying the MASTER_ADMIN code change.

-- Step 1: Update existing user records
UPDATE `users`
SET `role` = 'master_admin'
WHERE `role` = 'brandon';

-- Step 2 (MySQL ENUM columns only): extend enum and remove legacy value.
-- Skip this block if `role` is stored as VARCHAR.
-- ALTER TABLE `users`
--   MODIFY COLUMN `role` ENUM('master_admin', 'owner', 'admin', 'user') NOT NULL DEFAULT 'user';

-- Verify
SELECT `role`, COUNT(*) AS user_count
FROM `users`
GROUP BY `role`;
