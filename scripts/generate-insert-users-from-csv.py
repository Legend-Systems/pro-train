#!/usr/bin/env python3
"""Generate INSERT statements for CSV users that truly do not exist in MySQL."""

from __future__ import annotations

import csv
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = Path(
    r"c:\Users\chris\Downloads\ProTrain (essentials)\userBranchesAndWorkTypes.csv"
)
MYSQL_USERS_TSV = ROOT / "scripts" / "mysql-users-branches-full.tsv"
MYSQL_BRANCHES_TSV = ROOT / "scripts" / "mysql-branches-full.tsv"
OUT_SQL = ROOT / "scripts" / "insert-users-from-csv.sql"
OUT_MD = ROOT / "user-branch-csv-insert-candidates.md"

BIT_ORG_ID = "2"
LEGEND_ORG_ID = "1"
DENVER_BRANCH_ID = "2"
DENVER_ALIASES = {"bitdenver", "bitdrywall head office"}

TEMP_PASSWORD_HASH = (
    "$2b$12$8K8k8k8k8k8k8k8k8k8kOuPlaceholderReplaceBeforeRun"
)

EMAIL_ALIASES: dict[str, str] = {
    "fht.quality@gmail.com": "felex.ndlovu@bitgroup.co.za",
    "julian@bitgroup.co.za": "julian.diviani@bitgroup.co.za",
    "ruben@bitgroup.co.za": "ruben.tavares@bitgroup.co.za",
    "sales21@legendsystems.co.za": "sales21@bitgroup.co.za",
    "thoriso@legendsystems.co.za": "mahikeng@bitgroup.co.za",
    "lavhelesanidakalo@gmail.com": "louistrichardt@bitgroup.co.za",
    "jeandreb12345@icloud.com": "jeandre.bouwer@bitgroup.co.za",
    "penny@gmail.com": "penny@bitgroup.co.za",
    "ben@bitgroup.co.za": "bilal.mahomed@bitgroup.co.za",
    "patrick@gmail.com": "mosesvilakazi17@gmail.com",
    "brandonolifant10@gmail.com": "brandon.olifant@legendsystems.co.za",
    "sidney@bigroup.co.za": "sidney.maredi@bitgroup.co.za",
}


def norm_email(value: str) -> str:
    return value.strip().lower()


def norm_alias(value: str) -> str:
    return value.strip().lower()


def norm_name(first: str, last: str) -> str:
    return " ".join(f"{first} {last}".strip().lower().split())


def sql_escape(value: str) -> str:
    return value.replace("'", "''").replace("\\", "\\\\")


def load_mysql_users() -> tuple[dict[str, dict[str, str]], dict[str, list[dict[str, str]]]]:
    by_email: dict[str, dict[str, str]] = {}
    by_name: dict[str, list[dict[str, str]]] = {}

    with MYSQL_USERS_TSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            user = {
                "id": row["id"].strip(),
                "email": row["email"].strip(),
                "firstName": row["firstName"].strip(),
                "lastName": row["lastName"].strip(),
                "branchIdId": row["branchIdId"].strip() or None,
            }
            by_email[norm_email(user["email"])] = user
            name_key = norm_name(user["firstName"], user["lastName"])
            by_name.setdefault(name_key, []).append(user)

    return by_email, by_name


def load_mysql_branches() -> dict[str, dict[str, str]]:
    by_alias: dict[str, dict[str, str]] = {}
    with MYSQL_BRANCHES_TSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            branch = {
                "id": row["id"].strip(),
                "name": row["name"].strip(),
                "alias": row["alias"].strip() or None,
            }
            if branch["alias"]:
                by_alias[norm_alias(branch["alias"])] = branch
    by_alias[norm_alias("BitDenver")] = {
        "id": DENVER_BRANCH_ID,
        "name": "Denver - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD",
        "alias": None,
    }
    return by_alias


def resolve_branch(branch_alias: str, by_alias: dict[str, dict[str, str]]) -> dict[str, str] | None:
    alias_key = norm_alias(branch_alias)
    if alias_key in DENVER_ALIASES:
        return by_alias[norm_alias("BitDenver")]
    return by_alias.get(alias_key)


def resolve_org_id(branch_id: str) -> str:
    return LEGEND_ORG_ID if branch_id == "1" else BIT_ORG_ID


def resolve_mysql_email(
    csv_row: dict[str, str],
    by_email: dict[str, dict[str, str]],
    by_name: dict[str, list[dict[str, str]]],
) -> str | None:
    email = norm_email(csv_row["email"])
    if email in by_email:
        return by_email[email]["email"]

    alias_target = EMAIL_ALIASES.get(email)
    if alias_target and norm_email(alias_target) in by_email:
        return by_email[norm_email(alias_target)]["email"]

    name_key = norm_name(csv_row["first_name"], csv_row["last_name"])
    matches = by_name.get(name_key, [])
    if len(matches) == 1:
        return matches[0]["email"]

    return None


def exists_in_mysql(
    csv_row: dict[str, str],
    by_email: dict[str, dict[str, str]],
    by_name: dict[str, list[dict[str, str]]],
) -> tuple[bool, str]:
    mysql_email = resolve_mysql_email(csv_row, by_email, by_name)
    if mysql_email:
        csv_email = csv_row["email"].strip()
        if norm_email(csv_email) == norm_email(mysql_email):
            return True, f"email match: {mysql_email}"
        if norm_email(csv_email) in EMAIL_ALIASES:
            return True, f"known alias -> {mysql_email}"
        return True, f"name match: {mysql_email}"

    name_key = norm_name(csv_row["first_name"], csv_row["last_name"])
    matches = by_name.get(name_key, [])
    if len(matches) > 1:
        return True, f"name match ({len(matches)} users): {', '.join(u['email'] for u in matches)}"

    return False, ""


def try_bcrypt_hash() -> str:
    try:
        import bcrypt

        return bcrypt.hashpw(b"ProTrain@2026", bcrypt.gensalt(rounds=12)).decode()
    except ImportError:
        return TEMP_PASSWORD_HASH


def main() -> None:
    csv_rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
    by_email, by_name = load_mysql_users()
    by_alias = load_mysql_branches()
    password_hash = try_bcrypt_hash()

    insert_candidates: list[dict[str, str | None]] = []
    username_updates: list[dict[str, str]] = []
    skipped_duplicates: list[dict[str, str]] = []
    skipped_unresolved_branch: list[dict[str, str]] = []

    username_update_map: dict[str, dict[str, str]] = {}

    for row in csv_rows:
        username = row.get("username", "").strip()
        mysql_email = resolve_mysql_email(row, by_email, by_name)
        if mysql_email and username:
            key = norm_email(mysql_email)
            existing = username_update_map.get(key)
            prefer = norm_email(row["email"]) == norm_email(mysql_email)
            if not existing or (prefer and not existing.get("preferred")):
                username_update_map[key] = {
                    "mysql_email": mysql_email,
                    "username": username,
                    "csv_email": row["email"].strip(),
                    "preferred": prefer,
                }
            elif existing and existing["username"] != username:
                existing["csv_email"] = (
                    f"{existing['csv_email']} | conflict: {row['email'].strip()}->{username}"
                )

    username_updates = list(username_update_map.values())

    for row in csv_rows:
        username = row.get("username", "").strip()
        exists, reason = exists_in_mysql(row, by_email, by_name)
        if exists:
            skipped_duplicates.append(
                {
                    "email": row["email"].strip(),
                    "name": f"{row['first_name'].strip()} {row['last_name'].strip()}",
                    "csv_alias": row["branch_alias"].strip(),
                    "reason": reason,
                    "username": username,
                }
            )
            continue

        branch = resolve_branch(row["branch_alias"].strip(), by_alias)
        if not branch:
            skipped_unresolved_branch.append(row)
            continue

        branch_id = branch["id"]
        insert_candidates.append(
            {
                "id": str(uuid.uuid4()),
                "email": row["email"].strip(),
                "first_name": row["first_name"].strip(),
                "last_name": row["last_name"].strip(),
                "branch_id": branch_id,
                "branch_alias": row["branch_alias"].strip(),
                "org_id": resolve_org_id(branch_id),
                "username": username,
                "workforce_type": row.get("workforceType", "").strip(),
            }
        )

    sql_lines = [
        "-- Import users from userBranchesAndWorkTypes.csv",
        "-- Step 1: add username column (or run migration 1740700000000-AddUserUsernameColumn)",
        "-- Step 2: backfill usernames for existing MySQL users",
        "-- Step 3: insert new users with username",
        "-- Temporary password for new users: ProTrain@2026",
        "-- Review before running in production.",
        "",
        "START TRANSACTION;",
        "",
        "ALTER TABLE `users`",
        "ADD COLUMN `username` varchar(255) NULL;",
        "",
        "CREATE UNIQUE INDEX `IDX_USER_USERNAME` ON `users` (`username`);",
        "",
        f"-- Backfill usernames for {len(username_updates)} existing users matched from CSV",
    ]

    for update in username_updates:
        sql_lines.append(
            "UPDATE users "
            f"SET username = '{sql_escape(update['username'])}', "
            "updatedAt = CURRENT_TIMESTAMP(6) "
            f"WHERE LOWER(email) = LOWER('{sql_escape(update['mysql_email'])}'); "
            f"-- CSV: {update['csv_email']}"
        )

    sql_lines.extend(
        [
            "",
            f"-- Insert {len(insert_candidates)} new users",
        ]
    )

    for candidate in insert_candidates:
        sql_lines.append(
            "INSERT INTO users ("
            "id, email, password, firstName, lastName, username, role, emailVerified, status, "
            "createdAt, updatedAt, avatarId, orgIdId, branchIdId"
            ") VALUES ("
            f"'{sql_escape(str(candidate['id']))}', "
            f"'{sql_escape(str(candidate['email']))}', "
            f"'{password_hash}', "
            f"'{sql_escape(str(candidate['first_name']))}', "
            f"'{sql_escape(str(candidate['last_name']))}', "
            f"'{sql_escape(str(candidate['username']))}', "
            "'user', 0, 'active', "
            "CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), "
            "NULL, "
            f"'{candidate['org_id']}', "
            f"'{candidate['branch_id']}'"
            f"); "
            f"-- {candidate['username']} / {candidate['branch_alias']}"
        )

    sql_lines.extend(
        [
            "",
            "-- COMMIT;",
            "-- ROLLBACK;",
            "",
            f"-- Username updates: {len(username_updates)}",
            f"-- Total inserts: {len(insert_candidates)}",
        ]
    )

    OUT_SQL.write_text("\n".join(sql_lines) + "\n", encoding="utf-8")

    md_lines = [
        "# CSV Users — INSERT Candidates",
        "",
        "Users listed here have **no match in MySQL** by email, known alias, or normalized full name.",
        "",
        f"| Metric | Count |",
        f"|--------|------:|",
        f"| CSV users | {len(csv_rows)} |",
        f"| Username backfills (existing users) | {len(username_updates)} |",
        f"| Skipped (exist under different email/name) | {len(skipped_duplicates)} |",
        f"| Skipped (unresolved branch) | {len(skipped_unresolved_branch)} |",
        f"| **INSERT candidates** | **{len(insert_candidates)}** |",
        "",
        f"SQL file: `scripts/{OUT_SQL.name}`",
        "",
        "Temporary password for all new accounts: **`ProTrain@2026`**",
        "",
        "---",
        "",
        "## INSERT candidates",
        "",
    ]

    if insert_candidates:
        md_lines.append("| Username | Email | Name | Branch alias | Branch id |")
        md_lines.append("|----------|-------|------|--------------|-----------|")
        for row in insert_candidates:
            md_lines.append(
                f"| `{row['username']}` | `{row['email']}` | {row['first_name']} {row['last_name']} | "
                f"`{row['branch_alias']}` | `{row['branch_id']}` |"
            )
    else:
        md_lines.append("_No insert candidates._")

    md_lines.extend(["", "---", "", "## Skipped — likely already in MySQL", ""])
    md_lines.append("| Username | CSV email | Name | Reason |")
    md_lines.append("|----------|-----------|------|--------|")
    for row in sorted(skipped_duplicates, key=lambda item: item["email"].lower()):
        md_lines.append(
            f"| `{row.get('username', '')}` | `{row['email']}` | {row['name']} | {row['reason']} |"
        )

    OUT_MD.write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    print(f"Wrote {OUT_SQL} ({len(insert_candidates)} inserts, {len(username_updates)} username updates)")
    print(f"Wrote {OUT_MD}")
    print(f"skipped_duplicates={len(skipped_duplicates)}")
    print(f"skipped_unresolved_branch={len(skipped_unresolved_branch)}")


if __name__ == "__main__":
    main()
