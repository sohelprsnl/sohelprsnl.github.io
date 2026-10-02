#!/usr/bin/env python3
"""Rebuild the editable parts of the site from the files in data/.

Each data file fills one or more marked regions in the HTML pages:

  data/newsletter.json      articles.html archive, index.html latest three, issue counts
  data/publications.json    publications.html cards, publication counts
  data/home-stats.json      index.html number band
  data/achievements.json    index.html "Latest achievements"
  data/projects.json        projects.html cards (three sections), project counts
  data/coursework.json      ai-learning.html "Coursework"
  data/journal.json         ai-learning.html "Learning journal"
  data/certifications.json  resources.html "Certifications & training"

A region sits between <!-- NAME:START ... --> and <!-- NAME:END -->.
Anything inside a region is replaced on every build, so edit the data, not the HTML.
Everything outside the regions is left exactly as it is.

Run from anywhere:  python3 scripts/build_site.py
Standard library only. If any data file has an error, no page is written.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
ACCENTS = {"a-ops", "a-edu", "a-ai", "a-build", "a-write"}
STATUS_STYLES = {"progress", "live"}
PROJECT_SECTIONS = {"tools": "PROJECTS-TOOLS", "web": "PROJECTS-WEB", "open": "PROJECTS-OPEN"}
NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
                "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
                "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]


class DataError(ValueError):
    pass


# ---------- helpers ----------

def esc(value):
    """Plain text for element content."""
    return html.escape(str(value).strip(), quote=False)


def attr(value):
    """Plain text for an attribute value."""
    return html.escape(str(value).strip(), quote=True)


def link_target(url):
    return ' target="_blank" rel="noopener"' if str(url).startswith(("http://", "https://")) else ""


def month_label(value, where):
    m = re.fullmatch(r"(\d{4})-(\d{2})(?:-\d{2})?", str(value).strip())
    if not m or not 1 <= int(m.group(2)) <= 12:
        raise DataError(f"{where}: month must look like 2026-09, got {value!r}")
    return f"{MONTHS[int(m.group(2)) - 1]} {m.group(1)}"


def number_word(n, capital=False):
    word = NUMBER_WORDS[n] if n < len(NUMBER_WORDS) else str(n)
    return word.capitalize() if capital else word


def load(name, required, choices=None):
    """Load a JSON list and check required fields and fixed-choice fields."""
    path = DATA / name
    try:
        items = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise DataError(f"{name} is not valid JSON: {err}") from None
    if not isinstance(items, list) or not items:
        raise DataError(f"{name} must be a non-empty list")
    for n, item in enumerate(items, 1):
        where = f"{name}, item {n} ({item.get('title') or item.get('label') or 'no title'})"
        missing = [k for k in required if not str(item.get(k) or "").strip()]
        if missing:
            raise DataError(f"{where} is missing: {', '.join(missing)}")
        for key, allowed in (choices or {}).items():
            if item.get(key) not in allowed:
                raise DataError(f"{where}: {key} must be one of {', '.join(sorted(allowed))}")
        item["_where"] = where
        item["_n"] = n
    return items


def fill(text, name, body, indent, page):
    pad = " " * indent
    pattern = re.compile(rf"(<!-- {name}:START[^>]*-->\n).*?[ ]*<!-- {name}:END -->", re.S)
    if not pattern.search(text):
        raise DataError(f"{page}: markers {name}:START / {name}:END not found")
    return pattern.sub(lambda m: f"{m.group(1)}{body}\n{pad}<!-- {name}:END -->", text, count=1)


def sub(text, pattern, repl, label, page, required=True):
    new, n = re.subn(pattern, repl, text)
    if required and n == 0:
        raise DataError(f"{page}: could not find the {label} to update")
    return new


def indent_block(block, indent):
    pad = " " * indent
    return "\n".join(pad + line if line.strip() else "" for line in str(block).strip().splitlines())


# ---------- newsletter ----------

def newsletter_card(issue, indent, dot, comment):
    pad = " " * indent
    lines = [f"{pad}<!-- EDITION {issue['_n']} -->"] if comment else []
    lines += [
        f'{pad}<div class="article-card reveal">',
        f'{pad}  <span class="tag">{esc(issue["category"])}</span>',
        f'{pad}  <h3><a href="{attr(issue["url"])}" target="_blank" rel="noopener">{esc(issue["title"])}</a></h3>',
        f'{pad}  <p>{esc(issue["summary"])}</p>',
        f'{pad}  <div class="meta">{issue["_label"]} {dot} RMG Xpress Insights by Sohel</div>',
        f"{pad}</div>",
    ]
    return "\n".join(lines)


def build_newsletter(pages):
    issues = load("newsletter.json", ("title", "url", "category", "month", "summary"))
    for i in issues:
        if not str(i["url"]).startswith("https://"):
            raise DataError(f"{i['_where']}: url must start with https://")
        i["_label"] = month_label(i["month"], i["_where"])
    # Newest first: later month first; within a month, the later entry first.
    issues.sort(key=lambda i: (str(i["month"])[:7], i["_n"]), reverse=True)
    total = len(issues)

    p = "articles.html"
    pages[p] = fill(pages[p], "NEWSLETTER-ARCHIVE",
                    "\n\n".join(newsletter_card(i, 4, "&middot;", True) for i in issues), 4, p)
    pages[p] = sub(pages[p], r"All \d+ issues", f"All {total} issues", "'All N issues' text", p)
    pages[p] = sub(pages[p], r"edition 1 to \d+", f"edition 1 to {total}", "'edition 1 to N' text", p)

    p = "index.html"
    pages[p] = fill(pages[p], "NEWSLETTER-LATEST",
                    "\n".join(newsletter_card(i, 6, "·", False) for i in issues[:3]), 6, p)
    pages[p] = sub(pages[p], r"All newsletter issues \(\d+\)", f"All newsletter issues ({total})",
                   "home page issue count", p)
    return f"{total} newsletter issues"


# ---------- publications ----------

def build_publications(pages):
    pubs = load("publications.json", ("title", "url", "tag", "month", "summary", "meta"))
    for i in pubs:
        if not str(i["url"]).startswith("https://"):
            raise DataError(f"{i['_where']}: link must start with https://")
        i["_label"] = month_label(i["month"], i["_where"])
    pubs.sort(key=lambda i: (str(i["month"])[:7], i["_n"]), reverse=True)
    total = len(pubs)

    cards = []
    for i in pubs:
        cards.append("\n".join([
            f"    <!-- PUBLICATION {i['_n']} -->",
            '    <div class="article-card reveal">',
            f'      <span class="tag">{esc(i["tag"])}</span>',
            f'      <h3><a href="{attr(i["url"])}" target="_blank" rel="noopener">{esc(i["title"])}</a></h3>',
            f'      <p>{esc(i["summary"])}</p>',
            f'      <div class="meta">{i["_label"]} &middot; {esc(i["meta"])}</div>',
            "    </div>",
        ]))
    p = "publications.html"
    pages[p] = fill(pages[p], "PUBLICATIONS", "\n\n".join(cards), 4, p)
    pages[p] = sub(pages[p], r"All \d+ publications", f"All {total} publications", "'All N publications' text", p)
    p = "index.html"
    pages[p] = sub(pages[p], r"Article publications \(\d+\)", f"Article publications ({total})",
                   "home page publication count", p)
    return f"{total} publications"


# ---------- home stats ----------

def build_stats(pages):
    stats = load("home-stats.json", ("number", "label"))
    body = "\n".join(f'    <div class="stat"><div class="num">{esc(s["number"])}</div>'
                     f'<div class="lbl">{esc(s["label"])}</div></div>' for s in stats)
    pages["index.html"] = fill(pages["index.html"], "HOME-STATS", body, 4, "index.html")
    return f"{len(stats)} home numbers"


# ---------- achievements ----------

def build_achievements(pages):
    items = load("achievements.json", ("when", "title", "text", "accent"), {"accent": ACCENTS})
    blocks = []
    for a in items:
        text = esc(a["text"])
        url, label = str(a.get("link_url") or "").strip(), str(a.get("link_label") or "").strip()
        if url and label:
            text += f' <a href="{attr(url)}"{link_target(url)}>{esc(label)} &rarr;</a>'
        elif url or label:
            raise DataError(f"{a['_where']}: fill both link text and link, or leave both empty")
        blocks.append("\n".join([
            f'      <div class="achieve {a["accent"]} reveal">',
            f'        <div class="when">{esc(a["when"])}</div>',
            f'        <div class="what"><h3>{esc(a["title"])}</h3><p>{text}</p></div>',
            "      </div>",
        ]))
    pages["index.html"] = fill(pages["index.html"], "ACHIEVEMENTS", "\n".join(blocks), 6, "index.html")
    return f"{len(items)} achievements"


# ---------- learning journal ----------

def build_journal(pages):
    items = load("journal.json", ("when", "title", "text"))
    blocks = ["\n".join([
        '      <div class="achieve reveal">',
        f'        <div class="when">{esc(j["when"])}</div>',
        f'        <div class="what"><h3>{esc(j["title"])}</h3><p>{esc(j["text"])}</p></div>',
        "      </div>",
    ]) for j in items]
    pages["ai-learning.html"] = fill(pages["ai-learning.html"], "JOURNAL", "\n".join(blocks), 6, "ai-learning.html")
    return f"{len(items)} journal entries"


# ---------- projects ----------

def project_card(pr):
    cover = str(pr.get("cover") or "").strip()
    cls = f'card {pr["accent"]} has-cover reveal' if cover else f'card {pr["accent"]} reveal'
    pid = str(pr.get("id") or "").strip()
    id_attr = f' id="{attr(pid)}"' if pid else ""
    lines = [f'      <article class="{cls}"{id_attr}>']
    if cover:
        lines.append(f'        <img class="cover" loading="lazy" decoding="async" width="1200" height="630" '
                     f'src="{attr(cover)}" alt="{attr(pr.get("cover_alt") or pr["title"])}">')
    lines += [
        f'        <h3>{esc(pr["title"])}</h3>',
        f'        <p class="proj-meta">{esc(pr["meta"])}</p>',
        f'        <p>{esc(pr["intro"])}</p>',
    ]
    points = [p for p in (pr.get("points") or []) if str(p).strip()]
    if points:
        lines.append(f'        <p class="proj-label">{esc(pr.get("list_label") or "What it does")}</p>')
        lines.append('        <ul class="proj-list">' + "".join(f"<li>{esc(p)}</li>" for p in points) + "</ul>")
    foot = str(pr.get("footnote") or "").strip()
    if foot:
        lines.append(f'        <p class="proj-foot">{foot}</p>')
    url, label = str(pr.get("link_url") or "").strip(), str(pr.get("link_label") or "").strip()
    if url and label:
        lines.append(f'        <a class="more" href="{attr(url)}"{link_target(url)}>{esc(label)} &rarr;</a>')
    elif url or label:
        raise DataError(f"{pr['_where']}: fill both button text and link, or leave both empty")
    lines.append("      </article>")
    return "\n".join(lines)


def build_projects(pages):
    projects = load("projects.json", ("section", "title", "meta", "intro", "accent"),
                    {"section": set(PROJECT_SECTIONS), "accent": ACCENTS})
    p = "projects.html"
    for section, marker in PROJECT_SECTIONS.items():
        cards = [project_card(pr) for pr in projects if pr["section"] == section]
        if not cards:
            raise DataError(f"projects.json has no project in section '{section}'")
        pages[p] = fill(pages[p], marker, "\n".join(cards), 6, p)

    total = len(projects)
    tools = sum(1 for pr in projects if pr["section"] == "tools")
    for section, label in (("tools", "Merchandising tools"), ("web", "Web projects"),
                           ("open", "Open resources")):
        n = sum(1 for pr in projects if pr["section"] == section)
        pages[p] = sub(pages[p], rf"{label} \(\d+\)", f"{label} ({n})", f"'{label} (N)' button", p)
    for page in ("index.html", "projects.html", "ai-learning.html"):
        text = pages[page]
        text = sub(text, r"\b([A-Za-z]+|\d+) projects\b",
                   lambda m: (f"{number_word(total, m.group(1)[0].isupper())} projects"
                              if m.group(1).lower() in NUMBER_WORDS or m.group(1).isdigit() else m.group(0)),
                   "project count", page)
        pages[page] = text
    pages["index.html"] = sub(pages["index.html"], r"(projects\. )([A-Za-z]+|\d+)( you can try right now)",
                              lambda m: f"{m.group(1)}{number_word(tools, True)}{m.group(3)}",
                              "'N you can try right now' text", "index.html")
    return f"{total} projects ({tools} tools)"


# ---------- coursework and certifications ----------

def res_blocks(items):
    blocks = []
    for c in items:
        blocks.append("\n".join([
            f'      <div class="res {c["accent"]} reveal">',
            f'        <h3>{esc(c["title"])} <span class="status {c["status_style"]}">{esc(c["status"])}</span></h3>',
            indent_block(c["details"], 8),
            "      </div>",
        ]))
    return "\n".join(blocks)


def build_courses(pages):
    rules = (("title", "status", "status_style", "accent", "details"),
             {"accent": ACCENTS, "status_style": STATUS_STYLES})
    course = load("coursework.json", *rules)
    certs = load("certifications.json", *rules)
    pages["ai-learning.html"] = fill(pages["ai-learning.html"], "COURSEWORK", res_blocks(course), 6, "ai-learning.html")
    pages["resources.html"] = fill(pages["resources.html"], "CERTIFICATIONS", res_blocks(certs), 6, "resources.html")
    return f"{len(course)} courses, {len(certs)} certifications"


# ---------- main ----------

PAGES = ("index.html", "articles.html", "publications.html", "projects.html",
         "ai-learning.html", "resources.html")
STEPS = (build_newsletter, build_publications, build_stats, build_achievements,
         build_journal, build_projects, build_courses)


def main():
    original = {p: (ROOT / p).read_text(encoding="utf-8") for p in PAGES}
    pages = dict(original)
    report = [step(pages) for step in STEPS]   # any DataError stops here, before writing
    changed = [p for p in PAGES if pages[p] != original[p]]
    for p in changed:
        (ROOT / p).write_text(pages[p], encoding="utf-8")
    print("Built: " + "; ".join(report))
    print("Pages changed: " + (", ".join(changed) if changed else "none"))


if __name__ == "__main__":
    try:
        main()
    except DataError as err:
        sys.exit(f"Build stopped, no page was changed: {err}")
