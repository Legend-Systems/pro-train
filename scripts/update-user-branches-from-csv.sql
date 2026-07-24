-- Generated from userBranchesAndWorkTypes.csv
-- Match users by email; branches by CSV branch_alias (BitDenver -> branches.id = 2)
-- Review before running in production.

-- Preview rows that will change
SELECT
  u.id,
  u.email,
  u.branchIdId AS current_branch_id,
  b.id AS target_branch_id,
  b.alias AS target_alias,
  b.name AS target_name
FROM users u
INNER JOIN (
  SELECT 'prudencelencwe76@gmail.com' AS email, '28f70e60-604b-4c51-8760-357800bcccdf' AS target_branch_id
  UNION ALL
  SELECT 'mofokengfanyane74@gmail.com' AS email, '28f70e60-604b-4c51-8760-357800bcccdf' AS target_branch_id
  UNION ALL
  SELECT 'bethlehem@bitgroup.co.za' AS email, '28f70e60-604b-4c51-8760-357800bcccdf' AS target_branch_id
  UNION ALL
  SELECT 'tjaart.pretorius@bitgroup.co.za' AS email, '2' AS target_branch_id
  UNION ALL
  SELECT 'mosesvilakazi17@gmail.com' AS email, '54391e47-c7ef-47d0-8f4d-8e45f20bf3d0' AS target_branch_id
  UNION ALL
  SELECT 'stuurmantumi41@gmail.com' AS email, '30c19866-7ef5-4dcc-89f3-33f265146d31' AS target_branch_id
  UNION ALL
  SELECT 'burgersfort1@bitgroup.co.za' AS email, '06889faa-fc18-41f3-a186-6396fa7defca' AS target_branch_id
  UNION ALL
  SELECT 'nelson.matsinhe@bitgroup.co.za' AS email, 'fd80a488-e831-4229-8cfe-5c344494c606' AS target_branch_id
  UNION ALL
  SELECT 'giyani@bitgroup.co.za' AS email, 'fedb3796-a73f-4549-bf01-36fea1cfaa53' AS target_branch_id
  UNION ALL
  SELECT 'midrand2@bitgroup.co.za' AS email, '3d106cc4-eee7-48eb-a625-a9338afb9879' AS target_branch_id
  UNION ALL
  SELECT 'mokopane2@bitgroup.co.za' AS email, '48ce30a1-7991-4b0b-b538-569c128a9d6e' AS target_branch_id
  UNION ALL
  SELECT 'inocent.livhalani@bitgroup.co.za' AS email, 'b29610c2-0a79-4c3f-945e-31f6f1ee022e' AS target_branch_id
  UNION ALL
  SELECT 'soweto@bitgroup.co.za' AS email, 'f303a941-0723-4f55-96f1-47dd52c26494' AS target_branch_id
  UNION ALL
  SELECT 'patrick@bitgroup.co.za' AS email, '9299084b-1777-4214-9af3-3d5158e91e7e' AS target_branch_id
  UNION ALL
  SELECT 'rustenburg@bitgroup.co.za' AS email, '9299084b-1777-4214-9af3-3d5158e91e7e' AS target_branch_id
  UNION ALL
  SELECT 'southgate@bitgroup.co.za' AS email, '5de01bbf-d469-4b7b-b325-02cf2b986004' AS target_branch_id
  UNION ALL
  SELECT 'thohoyando@bitgroup.co.za' AS email, 'ff87c43a-42f9-4781-b472-204ba80a6bfd' AS target_branch_id
  UNION ALL
  SELECT 'tzaneen@bitgroup.co.za' AS email, '016e4cd7-8ff0-4d83-83db-3594490e4919' AS target_branch_id
) AS map ON LOWER(u.email) = map.email
INNER JOIN branches b ON b.id = map.target_branch_id
WHERE u.branchIdId IS NULL OR u.branchIdId <> map.target_branch_id;

-- Apply updates
UPDATE users u
INNER JOIN (
  SELECT 'prudencelencwe76@gmail.com' AS email, '28f70e60-604b-4c51-8760-357800bcccdf' AS target_branch_id
  UNION ALL
  SELECT 'mofokengfanyane74@gmail.com' AS email, '28f70e60-604b-4c51-8760-357800bcccdf' AS target_branch_id
  UNION ALL
  SELECT 'bethlehem@bitgroup.co.za' AS email, '28f70e60-604b-4c51-8760-357800bcccdf' AS target_branch_id
  UNION ALL
  SELECT 'tjaart.pretorius@bitgroup.co.za' AS email, '2' AS target_branch_id
  UNION ALL
  SELECT 'mosesvilakazi17@gmail.com' AS email, '54391e47-c7ef-47d0-8f4d-8e45f20bf3d0' AS target_branch_id
  UNION ALL
  SELECT 'stuurmantumi41@gmail.com' AS email, '30c19866-7ef5-4dcc-89f3-33f265146d31' AS target_branch_id
  UNION ALL
  SELECT 'burgersfort1@bitgroup.co.za' AS email, '06889faa-fc18-41f3-a186-6396fa7defca' AS target_branch_id
  UNION ALL
  SELECT 'nelson.matsinhe@bitgroup.co.za' AS email, 'fd80a488-e831-4229-8cfe-5c344494c606' AS target_branch_id
  UNION ALL
  SELECT 'giyani@bitgroup.co.za' AS email, 'fedb3796-a73f-4549-bf01-36fea1cfaa53' AS target_branch_id
  UNION ALL
  SELECT 'midrand2@bitgroup.co.za' AS email, '3d106cc4-eee7-48eb-a625-a9338afb9879' AS target_branch_id
  UNION ALL
  SELECT 'mokopane2@bitgroup.co.za' AS email, '48ce30a1-7991-4b0b-b538-569c128a9d6e' AS target_branch_id
  UNION ALL
  SELECT 'inocent.livhalani@bitgroup.co.za' AS email, 'b29610c2-0a79-4c3f-945e-31f6f1ee022e' AS target_branch_id
  UNION ALL
  SELECT 'soweto@bitgroup.co.za' AS email, 'f303a941-0723-4f55-96f1-47dd52c26494' AS target_branch_id
  UNION ALL
  SELECT 'patrick@bitgroup.co.za' AS email, '9299084b-1777-4214-9af3-3d5158e91e7e' AS target_branch_id
  UNION ALL
  SELECT 'rustenburg@bitgroup.co.za' AS email, '9299084b-1777-4214-9af3-3d5158e91e7e' AS target_branch_id
  UNION ALL
  SELECT 'southgate@bitgroup.co.za' AS email, '5de01bbf-d469-4b7b-b325-02cf2b986004' AS target_branch_id
  UNION ALL
  SELECT 'thohoyando@bitgroup.co.za' AS email, 'ff87c43a-42f9-4781-b472-204ba80a6bfd' AS target_branch_id
  UNION ALL
  SELECT 'tzaneen@bitgroup.co.za' AS email, '016e4cd7-8ff0-4d83-83db-3594490e4919' AS target_branch_id
) AS map ON LOWER(u.email) = map.email
SET u.branchIdId = map.target_branch_id,
    u.updatedAt = CURRENT_TIMESTAMP(6);

-- Staging-table approach (recommended for full CSV import)
/*
CREATE TEMPORARY TABLE csv_user_branches (
  email VARCHAR(320) NOT NULL PRIMARY KEY,
  branch_alias VARCHAR(255) NOT NULL
);

-- LOAD DATA or INSERT all CSV rows here

UPDATE users u
INNER JOIN csv_user_branches c ON LOWER(u.email) = LOWER(c.email)
INNER JOIN branches b
  ON (
    LOWER(COALESCE(b.alias, '')) = LOWER(c.branch_alias)
    OR (LOWER(c.branch_alias) IN ('bitdenver', 'bitdrywall head office') AND b.id = '2')
  )
SET u.branchIdId = b.id,
    u.updatedAt = CURRENT_TIMESTAMP(6);
*/

-- Individual UPDATE statements (explicit audit trail)
UPDATE users SET branchIdId = '28f70e60-604b-4c51-8760-357800bcccdf', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('prudencelencwe76@gmail.com'); -- BitBethlehem -> BitBethlehem
UPDATE users SET branchIdId = '28f70e60-604b-4c51-8760-357800bcccdf', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('mofokengfanyane74@gmail.com'); -- BitBethlehem -> BitBethlehem
UPDATE users SET branchIdId = '28f70e60-604b-4c51-8760-357800bcccdf', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('bethlehem@bitgroup.co.za'); -- BitBethlehem -> BitBethlehem
UPDATE users SET branchIdId = '2', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('tjaart.pretorius@bitgroup.co.za'); -- BitDenver -> Denver - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD
UPDATE users SET branchIdId = '54391e47-c7ef-47d0-8f4d-8e45f20bf3d0', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('mosesvilakazi17@gmail.com'); -- BitBoksburg -> BitBoksburg
UPDATE users SET branchIdId = '30c19866-7ef5-4dcc-89f3-33f265146d31', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('stuurmantumi41@gmail.com'); -- BitBronkhortspruit -> BitBronkhortspruit
UPDATE users SET branchIdId = '06889faa-fc18-41f3-a186-6396fa7defca', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('burgersfort1@bitgroup.co.za'); -- BitBurgersfort -> BitBurgersfort
UPDATE users SET branchIdId = 'fd80a488-e831-4229-8cfe-5c344494c606', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('nelson.matsinhe@bitgroup.co.za'); -- GIPTEC Matola -> GIPTEC Matola
UPDATE users SET branchIdId = 'fedb3796-a73f-4549-bf01-36fea1cfaa53', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('giyani@bitgroup.co.za'); -- BitGiyani -> BitGiyani
UPDATE users SET branchIdId = '3d106cc4-eee7-48eb-a625-a9338afb9879', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('Midrand2@bitgroup.co.za'); -- BitMidrand -> BitMidrand
UPDATE users SET branchIdId = '48ce30a1-7991-4b0b-b538-569c128a9d6e', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('mokopane2@bitgroup.co.za'); -- BitMokopane -> BitMokopane
UPDATE users SET branchIdId = 'b29610c2-0a79-4c3f-945e-31f6f1ee022e', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('inocent.livhalani@bitgroup.co.za'); -- BitPolokwane -> BitPolokwane
UPDATE users SET branchIdId = 'f303a941-0723-4f55-96f1-47dd52c26494', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('soweto@bitgroup.co.za'); -- BitRobertsville -> BitRobertsville
UPDATE users SET branchIdId = '9299084b-1777-4214-9af3-3d5158e91e7e', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('Patrick@bitgroup.co.za'); -- BitRustenburg -> BitRustenburg
UPDATE users SET branchIdId = '9299084b-1777-4214-9af3-3d5158e91e7e', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('Rustenburg@bitgroup.co.za'); -- BitRustenburg -> BitRustenburg
UPDATE users SET branchIdId = '5de01bbf-d469-4b7b-b325-02cf2b986004', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('Southgate@bitgroup.co.za'); -- BitSouthGate -> BitSouthGate
UPDATE users SET branchIdId = 'ff87c43a-42f9-4781-b472-204ba80a6bfd', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('Thohoyando@bitgroup.co.za'); -- BitThohoyandou -> BitThohoyandou
UPDATE users SET branchIdId = '016e4cd7-8ff0-4d83-83db-3594490e4919', updatedAt = CURRENT_TIMESTAMP(6) WHERE LOWER(email) = LOWER('tzaneen@bitgroup.co.za'); -- BitTzaneen -> BitTzaneen
