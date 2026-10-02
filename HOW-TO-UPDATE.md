# How to update sohelprsnl.com

The site is plain HTML on GitHub Pages. Nothing to pay for, nothing to log in to except GitHub.

## Everyday edits: use the forms

1. Go to https://app.pagescms.org and sign in with GitHub.
2. Open `sohelprsnl.github.io`.
3. Pick a form on the left, make the change, click Save.
4. Wait about two minutes. Reload the site.

| Form | What it changes |
|---|---|
| Newsletter issues | The archive page and the three newest issues on the home page |
| Publications | The publications page and the count on the home page |
| Home page numbers | The five big numbers under the photo |
| Home page achievements | The "Latest achievements" list |
| Projects | Every project card, in three sections |
| AI learning journal | The dated log on AI Learning |
| AI coursework | The Coursework list on AI Learning |
| Certifications and training | The list on Resources |

Counts such as "All 32 issues" and "Nine projects" update by themselves.

## Everything else: Pages (raw HTML)

Headings, paragraphs, the About page, the Career Journey and so on have no form.
Open the page under "Pages (raw HTML)" and edit the text in place.
Leave the blocks between `<!-- NAME:START -->` and `<!-- NAME:END -->` alone.
The build rewrites those from the data files, so edits there are lost.

## If a save does not show up

1. Open the repo on GitHub and click the Actions tab.
2. The latest "Build site from data" run should have a green tick.
3. A red cross means a data error. Open the run; the last line names the file and the item.
   The live site is unchanged until you fix it and save again.

## On a computer, without the form

Edit a file in `data/`, then run `python3 scripts/build_site.py` and push.
The script needs Python 3 and nothing else.
