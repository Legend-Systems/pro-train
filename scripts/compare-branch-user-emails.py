"""Compare branch CSV emails against ProTrain users table and write branch-data.md."""
import csv
from pathlib import Path

import pymysql

BRANCH_CSV = Path(r"c:\Users\chris\Downloads\ProTrain (essentials)\data\branch-loro-data.csv")
OUTPUT = Path(__file__).resolve().parent.parent / "branch-data.md"
ORG_ID = "2"


def main() -> None:
    branch_rows: list[dict[str, str]] = []
    with BRANCH_CSV.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            email = (row.get("email") or "").strip()
            if not email:
                continue
            branch_rows.append(
                {
                    "name": (row.get("name") or "").strip(),
                    "alias": (row.get("alias") or "").strip(),
                    "email": email,
                }
            )

    branch_by_email = {row["email"].lower(): row for row in branch_rows}

    connection = pymysql.connect(
        host="129.232.204.10",
        port=3306,
        user="yanga",
        password="Yanga@1501",
        database="trainpro",
        charset="utf8mb4",
    )

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT email, firstName, lastName, orgIdId, branchIdId "
                "FROM users WHERE orgIdId = %s ORDER BY email",
                (ORG_ID,),
            )
            user_rows = cursor.fetchall()

            cursor.execute(
                "SELECT email, name, alias FROM branches "
                "WHERE organizationId = %s ORDER BY email",
                (ORG_ID,),
            )
            db_branch_rows = cursor.fetchall()
    finally:
        connection.close()

    users_by_email: dict[str, dict[str, str | None]] = {}
    for email, first_name, last_name, org_id, branch_id in user_rows:
        if not email:
            continue
        users_by_email[email.lower()] = {
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "orgId": org_id,
            "branchId": branch_id,
        }

    db_branches_by_email: dict[str, dict[str, str | None]] = {}
    for email, name, alias in db_branch_rows:
        if not email:
            continue
        db_branches_by_email[email.lower()] = {
            "email": email,
            "name": name,
            "alias": alias,
        }

    present: list[dict[str, str]] = []
    missing: list[dict[str, str]] = []
    for email_lower, info in sorted(branch_by_email.items(), key=lambda item: item[1]["email"]):
        if email_lower in users_by_email:
            present.append(info)
        else:
            missing.append(info)

    lines = [
        "# Branch Data Email Comparison",
        "",
        "Comparison of branch emails from `branch-loro-data.csv` against the ProTrain "
        f"`users` table (organizationId = `{ORG_ID}`).",
        "",
        f"- Branch CSV rows: **{len(branch_rows)}**",
        f"- Users in DB (org {ORG_ID}): **{len(users_by_email)}**",
        f"- Branches in DB (org {ORG_ID}): **{len(db_branches_by_email)}**",
        f"- Branch CSV emails found in users table: **{len(present)}**",
        f"- Branch CSV emails **not** in users table: **{len(missing)}**",
        "",
        "## Branch CSV emails present in users table",
        "",
    ]

    if present:
        lines.extend(
            [
                "| Branch name | Alias | Branch email | Matching user |",
                "| --- | --- | --- | --- |",
            ]
        )
        for info in present:
            user = users_by_email[info["email"].lower()]
            lines.append(
                f"| {info['name']} | {info['alias']} | `{info['email']}` | "
                f"{user['firstName']} {user['lastName']} (`{user['email']}`) |"
            )
    else:
        lines.append("_None._")

    lines.extend(["", "## Branch CSV emails not in users table", ""])
    if missing:
        lines.extend(
            [
                "| Branch name | Alias | Branch email |",
                "| --- | --- | --- |",
            ]
        )
        for info in missing:
            lines.append(f"| {info['name']} | {info['alias']} | `{info['email']}` |")
    else:
        lines.append("_All branch CSV emails exist in the users table._")

    lines.extend(["", "## All user emails in database (org 2)", ""])
    lines.extend(["| Email | First name | Last name | Branch ID |", "| --- | --- | --- | --- |"])
    for email_lower in sorted(users_by_email.keys()):
        user = users_by_email[email_lower]
        branch_id = user["branchId"] or "—"
        lines.append(
            f"| `{user['email']}` | {user['firstName']} | {user['lastName']} | {branch_id} |"
        )

    lines.extend(["", "## All branch emails in database (org 2)", ""])
    lines.extend(["| Email | Branch name | Alias |", "| --- | --- | --- |"])
    for email_lower in sorted(db_branches_by_email.keys()):
        branch = db_branches_by_email[email_lower]
        alias = branch["alias"] or "—"
        lines.append(f"| `{branch['email']}` | {branch['name']} | {alias} |")

    OUTPUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    print(f"Missing count: {len(missing)}")
    for item in missing:
        print(f"  - {item['email']} ({item['alias']})")


if __name__ == "__main__":
    main()
