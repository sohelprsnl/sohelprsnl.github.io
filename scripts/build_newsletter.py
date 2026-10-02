#!/usr/bin/env python3
"""Rebuild the newsletter cards and issue counts from data/newsletter.json.

data/newsletter.json lists issues oldest first. Add each new issue at the end.
The script writes:
  articles.html  every issue, newest first, plus the issue counts
  index.html     the three newest issues, plus the count on the button
Run from the repo root:  python3 scripts/build_newsletter.py
Only the standard library is used, so it runs on GitHub Actions as is.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "newsletter.json"
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
REQUIRED = ("title", "url", "category", "month", "summary")


def esc(text):
    return html.escape(str(text).strip(), quote=False)


def month_label(value):
    m = re.fullmatch(r"(\d{4})-(\d{2})(?:-\d{2})?", str(value).strip())
    if not m or not 1 <= int(m.group(2)) <= 12:
        raise ValueError(f"month must look like 2026-09, got {value!r}")
    return f"{MONTHS[int(m.group(2)) - 1]} {m.group(1)}"


def load_issues():
    issues = json.loads(DATA.read_text(encoding="utf-8"))
    if not isinstance(issues, list) or not issues:
        raise ValueError("data/newsletter.json must be a non-empty list")
    for n, issue in enumerate(issues, 1):
        missing = [k for k in REQUIRED if not str(issue.get(k, "")).strip()]
        if missing:
            raise ValueError(f"issue {n} ({issue.get('title', 'no title')}) "
                             f"is missing: {', '.join(missing)}")
        if not str(issue["url"]).startswith("https://"):
            raise ValueError(f"issue {n} url must start with https://")
        issue["_label"] = month_label(issue["month"])
        issue["_edition"] = n
    # Newest first: later month first; within a month, the later entry first.
    return sorted(issues, key=lambda i: (str(i["month"])[:7], i["_edition"]),
                  reverse=True)


def card(issue, indent, dot, edition_comment):
    pad = " " * indent
    lines = []
    if edition_comment:
        lines.append(f"{pad}<!-- EDITION {issue['_edition']} -->")
    lines += [
        f'{pad}<div class="article-card reveal">',
        f'{pad}  <span class="tag">{esc(issue["category"])}</span>',
        f'{pad}  <h3><a href="{html.escape(issue["url"].strip())}" target="_blank" '
        f'rel="noopener">{esc(issue["title"])}</a></h3>',
        f'{pad}  <p>{esc(issue["summary"])}</p>',
        f'{pad}  <div class="meta">{issue["_label"]} {dot} RMG Xpress Insights by Sohel</div>',
        f"{pad}</div>",
    ]
    return "\n".join(lines)


def fill(text, name, body, indent):
    pad = " " * indent
    pattern = re.compile(
        rf"(<!-- {name}:START[^>]*-->\n).*?[ ]*<!-- {name}:END -->", re.S)
    if not pattern.search(text):
        raise ValueError(f"markers {name}:START / {name}:END not found")
    return pattern.sub(
        lambda m: f"{m.group(1)}{body}\n{pad}<!-- {name}:END -->", text, count=1)


def sub_count(text, pattern, repl, label):
    new, n = re.subn(pattern, repl, text)
    if n == 0:
        raise ValueError(f"could not find the {label} to update")
    return new


def main():
    issues = load_issues()
    total = len(issues)

    path = ROOT / "articles.html"
    text = path.read_text(encoding="utf-8")
    body = "\n\n".join(card(i, 4, "&middot;", True) for i in issues)
    text = fill(text, "NEWSLETTER-ARCHIVE", body, 4)
    text = sub_count(text, r"All \d+ issues", f"All {total} issues", "'All N issues' text")
    text = sub_count(text, r"edition 1 to \d+", f"edition 1 to {total}", "'edition 1 to N' text")
    path.write_text(text, encoding="utf-8")

    path = ROOT / "index.html"
    text = path.read_text(encoding="utf-8")
    body = "\n".join(card(i, 6, "·", False) for i in issues[:3])
    text = fill(text, "NEWSLETTER-LATEST", body, 6)
    text = sub_count(text, r"All newsletter issues \(\d+\)",
                     f"All newsletter issues ({total})", "home page issue count")
    path.write_text(text, encoding="utf-8")

    print(f"Built {total} issues. Newest: {issues[0]['title']} ({issues[0]['_label']})")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, json.JSONDecodeError) as err:
        sys.exit(f"Newsletter build stopped, nothing was published: {err}")
