#!/usr/bin/env python3
"""Compare CSV user branches against full MySQL exports and generate markdown + SQL."""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = Path(
    r"c:\Users\chris\Downloads\ProTrain (essentials)\userBranchesAndWorkTypes.csv"
)
MYSQL_USERS_TSV = ROOT / "scripts" / "mysql-users-branches-full.tsv"
MYSQL_BRANCHES_TSV = ROOT / "scripts" / "mysql-branches-full.tsv"
OUT_MD = ROOT / "user-branch-csv-mysql-comparison.md"
OUT_SQL = ROOT / "scripts" / "update-user-branches-from-csv.sql"

# CSV aliases that map to Denver branch (id=2) when alias is BitDenver / BitDrywall Head Office
DENVER_BRANCH_ID = "2"
DENVER_ALIASES = {"bitdenver", "bitdrywall head office"}


def norm_email(value: str) -> str:
    return value.strip().lower()


def norm_alias(value: str) -> str:
    return value.strip().lower()


def load_mysql_users() -> dict[str, dict[str, str]]:
    users: dict[str, dict[str, str]] = {}
    with MYSQL_USERS_TSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            email = norm_email(row["email"])
            users[email] = {
                "id": row["id"].strip(),
                "email": row["email"].strip(),
                "firstName": row["firstName"].strip(),
                "lastName": row["lastName"].strip(),
                "branchIdId": row["branchIdId"].strip() or None,
            }
    return users


def load_mysql_branches() -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    by_alias: dict[str, dict[str, str]] = {}
    by_name: dict[str, dict[str, str]] = {}
    with MYSQL_BRANCHES_TSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            branch = {
                "id": row["id"].strip(),
                "name": row["name"].strip(),
                "alias": row["alias"].strip() or None,
            }
            if branch["alias"]:
                by_alias[norm_alias(branch["alias"])] = branch
            by_name[norm_alias(branch["name"])] = branch
    by_alias[norm_alias("BitDenver")] = {
        "id": DENVER_BRANCH_ID,
        "name": "Denver - BRADEIRENSE INTERNATIONAL TRADING (PTY) LTD",
        "alias": None,
    }
    return by_alias, by_name


def resolve_branch(
    branch_alias: str,
    branch_name: str,
    by_alias: dict[str, dict[str, str]],
    by_name: dict[str, dict[str, str]],
) -> dict[str, str] | None:
    alias_key = norm_alias(branch_alias)
    if alias_key in DENVER_ALIASES:
        return by_alias[norm_alias("BitDenver")]
    if alias_key in by_alias:
        return by_alias[alias_key]
    name_key = norm_alias(branch_name)
    if name_key in by_name:
        return by_name[name_key]
    return None


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def main() -> None:
    csv_rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
    mysql_users = load_mysql_users()
    by_alias, by_name = load_mysql_branches()

    missing_users: list[dict[str, str]] = []
    matched_updates: list[dict[str, str | None]] = []
    unresolved_branch: list[dict[str, str]] = []
    already_correct = 0
    needs_update = 0

    for row in csv_rows:
        email = norm_email(row["email"])
        user = mysql_users.get(email)
        if not user:
            missing_users.append(row)
            continue

        branch = resolve_branch(
            row["branch_alias"],
            row["branch_name"],
            by_alias,
            by_name,
        )
        if not branch:
            unresolved_branch.append(
                {
                    "email": user["email"],
                    "user_id": user["id"],
                    "csv_alias": row["branch_alias"].strip(),
                    "csv_name": row["branch_name"].strip(),
                    "current_branch": user["branchIdId"],
                }
            )
            continue

        target_id = branch["id"]
        current = user["branchIdId"]
        if current == target_id:
            already_correct += 1
        else:
            needs_update += 1

        matched_updates.append(
            {
                "user_id": user["id"],
                "email": user["email"],
                "first_name": row["first_name"].strip(),
                "last_name": row["last_name"].strip(),
                "csv_alias": row["branch_alias"].strip(),
                "target_branch_id": target_id,
                "target_branch_alias": branch["alias"],
                "target_branch_name": branch["name"],
                "current_branch_id": current,
                "needs_update": current != target_id,
            }
        )

    csv_branch_keys = sorted(
        {(r["branch_alias"].strip(), r["branch_name"].strip()) for r in csv_rows},
        key=lambda item: item[0].lower(),
    )
    missing_branches: list[tuple[str, str]] = []
    found_branches: list[tuple[str, str, dict[str, str]]] = []
    for alias, name in csv_branch_keys:
        branch = resolve_branch(alias, name, by_alias, by_name)
        if branch:
            found_branches.append((alias, name, branch))
        else:
            missing_branches.append((alias, name))

    # Build SQL
    sql_lines: list[str] = [
        "-- Generated from userBranchesAndWorkTypes.csv",
        "-- Match users by email; branches by CSV branch_alias (BitDenver -> branches.id = 2)",
        "-- Review before running in production.",
        "",
        "-- Preview rows that will change",
        "SELECT",
        "  u.id,",
        "  u.email,",
        "  u.branchIdId AS current_branch_id,",
        "  b.id AS target_branch_id,",
        "  b.alias AS target_alias,",
        "  b.name AS target_name",
        "FROM users u",
        "INNER JOIN (",
    ]

    update_rows = [r for r in matched_updates if r["needs_update"]]
    if update_rows:
        union_parts = []
        for row in update_rows:
            union_parts.append(
                "  SELECT "
                f"'{sql_escape(norm_email(str(row['email'])))}' AS email, "
                f"'{sql_escape(str(row['target_branch_id']))}' AS target_branch_id"
            )
        sql_lines.append("\n  UNION ALL\n".join(union_parts))
    else:
        sql_lines.append("  SELECT NULL AS email, NULL AS target_branch_id WHERE 1 = 0")

    sql_lines.extend(
        [
            ") AS map ON LOWER(u.email) = map.email",
            "INNER JOIN branches b ON b.id = map.target_branch_id",
            "WHERE u.branchIdId IS NULL OR u.branchIdId <> map.target_branch_id;",
            "",
            "-- Apply updates",
            "UPDATE users u",
            "INNER JOIN (",
        ]
    )

    if update_rows:
        sql_lines.append("\n  UNION ALL\n".join(union_parts))
    else:
        sql_lines.append("  SELECT NULL AS email, NULL AS target_branch_id WHERE 1 = 0")

    sql_lines.extend(
        [
            ") AS map ON LOWER(u.email) = map.email",
            "SET u.branchIdId = map.target_branch_id,",
            "    u.updatedAt = CURRENT_TIMESTAMP(6);",
            "",
            "-- Staging-table approach (recommended for full CSV import)",
            "/*",
            "CREATE TEMPORARY TABLE csv_user_branches (",
            "  email VARCHAR(320) NOT NULL PRIMARY KEY,",
            "  branch_alias VARCHAR(255) NOT NULL",
            ");",
            "",
            "-- LOAD DATA or INSERT all CSV rows here",
            "",
            "UPDATE users u",
            "INNER JOIN csv_user_branches c ON LOWER(u.email) = LOWER(c.email)",
            "INNER JOIN branches b",
            "  ON (",
            "    LOWER(COALESCE(b.alias, '')) = LOWER(c.branch_alias)",
            "    OR (LOWER(c.branch_alias) IN ('bitdenver', 'bitdrywall head office') AND b.id = '2')",
            "  )",
            "SET u.branchIdId = b.id,",
            "    u.updatedAt = CURRENT_TIMESTAMP(6);",
            "*/",
            "",
            "-- Individual UPDATE statements (explicit audit trail)",
        ]
    )

    for row in update_rows:
        alias = row["csv_alias"]
        branch_label = row["target_branch_alias"] or row["target_branch_name"]
        sql_lines.append(
            f"UPDATE users SET branchIdId = '{sql_escape(str(row['target_branch_id']))}', "
            f"updatedAt = CURRENT_TIMESTAMP(6) "
            f"WHERE LOWER(email) = LOWER('{sql_escape(str(row['email']))}'); "
            f"-- {alias} -> {branch_label}"
        )

    OUT_SQL.write_text("\n".join(sql_lines) + "\n", encoding="utf-8")

    # Markdown
    lines: list[str] = [
        "# CSV vs MySQL User/Branch Comparison (Full Dataset)",
        "",
        "Source CSV: `userBranchesAndWorkTypes.csv`",
        "",
        f"MySQL users compared: **{len(mysql_users)}**",
        f"MySQL branches compared: **{len(list(Path(MYSQL_BRANCHES_TSV).open())) - 1}**",
        "",
        "Matching rules:",
        "- Users matched by **email** (case-insensitive)",
        "- Branches matched by CSV **`branch_alias`** → MySQL **`branches.alias`**",
        "- CSV **`BitDenver`** / **`BitDrywall Head Office`** → MySQL branch **`id = '2'`** (Denver)",
        "",
        "## Summary",
        "",
        f"| Metric | Count |",
        f"|--------|------:|",
        f"| CSV users | {len(csv_rows)} |",
        f"| CSV users missing from MySQL | {len(missing_users)} |",
        f"| CSV users matched in MySQL | {len(matched_updates)} |",
        f"| Matched users already on correct branch | {already_correct} |",
        f"| Matched users needing branch update | {needs_update} |",
        f"| Matched users with unresolved CSV branch | {len(unresolved_branch)} |",
        f"| CSV unique branches | {len(csv_branch_keys)} |",
        f"| CSV branches found in MySQL | {len(found_branches)} |",
        f"| CSV branches missing from MySQL | {len(missing_branches)} |",
        "",
        f"Generated SQL file: `{OUT_SQL.name}`",
        "",
        "---",
        "",
        "## 1. CSV users not found in MySQL",
        "",
    ]

    if missing_users:
        lines.append("| # | Name | Email | CSV branch alias |")
        lines.append("|---|------|-------|------------------|")
        for index, row in enumerate(missing_users, 1):
            name = f"{row['first_name'].strip()} {row['last_name'].strip()}".strip()
            lines.append(
                f"| {index} | {name} | `{row['email'].strip()}` | `{row['branch_alias'].strip()}` |"
            )
    else:
        lines.append("_None — every CSV email exists in MySQL._")

    lines.extend(["", "---", "", "## 2. Branch update SQL", ""])
    lines.append(
        f"**{needs_update}** users need `branchIdId` updated. "
        f"**{already_correct}** matched users are already correct."
    )
    lines.append("")
    lines.append("Run the generated script after review:")
    lines.append("")
    lines.append("```sql")
    lines.append(f"-- See scripts/{OUT_SQL.name}")
    lines.append("```")
    lines.append("")
    lines.append("### Users requiring branch changes")
    lines.append("")
    if update_rows:
        lines.append(
            "| Email | Current branch | Target branch id | CSV alias | Target branch |"
        )
        lines.append(
            "|-------|----------------|------------------|-----------|---------------|"
        )
        for row in update_rows:
            target = row["target_branch_alias"] or row["target_branch_name"]
            lines.append(
                f"| `{row['email']}` | `{row['current_branch_id']}` | "
                f"`{row['target_branch_id']}` | `{row['csv_alias']}` | {target} |"
            )
    else:
        lines.append("_No branch updates required for matched users._")

    if unresolved_branch:
        lines.extend(["", "### Matched users with CSV branch not resolved in MySQL", ""])
        lines.append("| Email | CSV alias | Current branch |")
        lines.append("|-------|-----------|----------------|")
        for row in unresolved_branch:
            lines.append(
                f"| `{row['email']}` | `{row['csv_alias']}` | `{row['current_branch']}` |"
            )

    lines.extend(["", "---", "", "## 3. CSV branches not found in MySQL", ""])
    if missing_branches:
        lines.append("| # | CSV branch_alias | CSV branch_name |")
        lines.append("|---|------------------|-----------------|")
        for index, (alias, name) in enumerate(missing_branches, 1):
            lines.append(f"| {index} | `{alias}` | {name} |")
    else:
        lines.append("_None — every CSV branch alias maps to a MySQL branch._")

    lines.extend(["", "### CSV branches successfully mapped", ""])
    lines.append("| CSV alias | MySQL id | MySQL alias | MySQL name |")
    lines.append("|-----------|----------|-------------|------------|")
    for alias, _name, branch in found_branches:
        lines.append(
            f"| `{alias}` | `{branch['id']}` | `{branch['alias']}` | {branch['name']} |"
        )

    lines.extend(
        [
            "",
            "---",
            "",
            "## Notes",
            "",
            "1. Several CSV people may exist in MySQL under **different emails** (branch mailbox accounts vs personal emails). Those appear under section 1 as missing unless emails align exactly.",
            "2. MySQL branch **`BitLanseria`** exists but has **no users** in the CSV.",
            "3. MySQL branch **`BitEmalahleni`** exists separately from **`BitWitbank`**; CSV uses **`BitWitbank`** for Witbank users.",
            "4. **`richardsbay@bitgroup.co.za`** in CSV maps to Denver head office; MySQL branch account **`RichardsBay@bitgroup.co.za`** may need a separate decision if that mailbox should stay on **`BitRichards Bay`** (`678729c8-...`).",
            "",
        ]
    )

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")

    print(f"Wrote {OUT_MD}")
    print(f"Wrote {OUT_SQL}")
    print(
        f"missing_users={len(missing_users)} matched={len(matched_updates)} "
        f"needs_update={needs_update} missing_branches={len(missing_branches)}"
    )


if __name__ == "__main__":
    main()
