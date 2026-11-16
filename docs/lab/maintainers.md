# Maintainer and instructor guide

For people who keep the learning lab accurate, or teach it as a workshop.

## Run the lab from a fresh checkout

```bash
git clone https://github.com/kenwalger/cellar-api.git
cd cellar-api
node scripts/lab-docs.mjs --check
```

Then work through [Exercises 0 to 5](README.md) as a learner would, in a POSIX shell. The whole run takes under an hour and needs no Google account.

## How the lab is verified

`node scripts/lab-docs.mjs --check` runs in CI (the `parser` job), next to the parser, estimator, and adapter tests and the Apps Script drift check. It has no dependencies, and it fails if any of these is out of date:

| Check | What it verifies |
|---|---|
| Documented outputs | Each `<!-- lab-output … -->` block's command is run with Node, from the stated folder, and its output and exit status must match the page exactly. For Exercise 3, it first makes the broken copy itself, deleting line 387 only if that line is `[/ONSET]`, and removes the copy afterwards. |
| Estimate tables | Each `<!-- lab-estimate … -->` table must equal the estimator's result for the master script with those options |
| Example manifests | `docs/lab/examples/*.json` must equal what the real `Generator` produces offline with test doubles, and Exercise 5's claims about them must hold. For example, both runs have the same source hash, which equals the SHA-256 of `course/master-script.md`. |
| Links | Relative links in the lab pages, `README.md`, and `docs/*.md` point to existing files and headings. Links to `github.com/kenwalger/cellar-api` point to existing paths and headings. On the lab pages, relative links reach only files that GitHub Pages publishes. |
| Pages navigation | Every published page is listed in `_data/lab.yml` with the URL Jekyll gives it, and `docs/index.md` is the site's home page |
| Commands | Every `npm run <script>` in a lab code block exists in a `package.json`, and every `node <file>` exists |
| Mermaid | Each Mermaid block starts with a `flowchart` direction, has balanced brackets and quotes, and has no stray lines |
| Private data | No Google Docs, Drive, or Apps Script URLs with IDs, Drive-like IDs, access tokens, API keys, or email addresses in the lab pages or examples |
| GitHub Pages | No Liquid delimiters (two opening braces, or an opening brace followed by a percent sign) in lab pages, which Jekyll would swallow |

Commands that aren't Node commands, such as `grep`, `cp`, `sha256sum`, and `git diff`, can't be checked automatically. Their expected results are stated in the prose, and they depend on the script and the hashes the checker does verify. Recheck them by hand when the script changes.

## Independently maintained fixtures

Never regenerate these from parser or estimator output. They're the outside oracles the code is tested against:

- [`course/fixtures/expected-structure.json`](https://github.com/kenwalger/cellar-api/blob/main/course/fixtures/expected-structure.json): the course outline
- [`course/fixtures/malformed-script.md`](https://github.com/kenwalger/cellar-api/blob/main/course/fixtures/malformed-script.md): the four defect cases
- The reference word counts in [`production/tests/fixtures.test.js`](https://github.com/kenwalger/cellar-api/blob/main/production/tests/fixtures.test.js)

The lab's own outputs, tables, and example manifests **are** generated, on purpose. They're teaching material that must follow the code, not oracles.

## After a parser, estimator, generator, or script change

1. Make the change and its tests, and run `node scripts/sync-apps-script.mjs` if the parser or estimator core changed.
2. Run `node scripts/lab-docs.mjs`. It refreshes every documented output, estimate table, and example manifest.
3. Review the diff (`git diff docs/lab`) as you would a code change. Every changed number should be explained by your change.
4. Update the figures quoted in prose, which the checker can't see. Search for the old values, for example `grep -rn "1978\|664\|14 min 8 s\|line 38[0-9]" docs/lab docs/index.md`. Figures appear in Exercises 1, 3, 4, 5, and 6 and in the evidence guide's alt text.
5. Run `node scripts/lab-docs.mjs --check` and the full test suite.

If the line numbers in Exercise 3 change, update `delete-line` in its two markers and the prose. The checker refuses to delete a line that isn't `[/ONSET]`.

## Which steps need Google access

Only [Exercise 6](06-google-docs-extension.md) and evidence items 6 to 11, plus item 12 when it's a live manifest. Everything else runs offline. CI never has Google credentials.

## Capturing and publishing screenshots

Follow the [evidence guide](evidence/README.md). It gives each screenshot's content, redactions, filename, and alt text. Capture from a real run only, never mock up or edit an image to look like output, and update the guide's inventory when you add one. Review every image at full size for IDs, URLs, email addresses, and avatars before merging.

## Keeping private information out

- Never commit `apps-script/.clasp.json`, Script Properties values, or real document or folder IDs. `.gitignore` covers `.clasp.json`, and the checker scans the lab for the rest.
- A live `manifest.json` contains real Drive IDs and URLs. Don't commit one. If you want to show one, use a redacted screenshot.
- The example manifests use the reserved `.test` domain and obvious placeholders for that reason.

## Claims: offline-tested, owner-reported, or not yet live

Keep the three levels apart in every page you write:

| Level | Meaning | Currently |
|---|---|---|
| **Tested offline** | Proven by tests that run in CI, without Google | Parser, estimator, generator logic, rendering models, manifest, lab outputs |
| **Owner-reported live** | The project owner ran it in Google and reported success | Phase 3B role documents, Phase 4 Production Summary (run `6146a211`). Item-by-item checklists weren't recorded. |
| **Not yet live-verified** | Implemented and tested offline only | Phase 4b presentation: monospaced examples, compact `[PAUSE]` cues, the overview table, the revised narration in a live Doc |

Move an item up only when a person has run the [live checklist](https://github.com/kenwalger/cellar-api/blob/main/apps-script/README.md#live-verification-checklist) and recorded the result. Never write "verified in Google" because tests pass.

## A 60-minute workshop

| Time | Activity |
|---|---|
| 0:00 to 0:05 | The problem: three teams, three scripts, and one late edit. Show the [architecture diagram](../index.md#how-it-works). |
| 0:05 to 0:10 | [Exercise 0](00-setup.md). Have learners clone and run the tests while you introduce the course script. |
| 0:10 to 0:20 | [Exercise 1](01-inspect-the-source.md): read the source, and discuss why roles are separated |
| 0:20 to 0:30 | [Exercise 2](02-parse-and-validate.md): outline, IR, and determinism |
| 0:30 to 0:38 | [Exercise 3](03-break-the-contract.md): break a copy, and compare diagnostics with the gate |
| 0:38 to 0:50 | [Exercise 4](04-estimate-production.md): rates and allowances, and the facts versus assumptions table |
| 0:50 to 0:58 | [Exercise 5](05-provenance-and-regeneration.md): hashes and the run comparison |
| 0:58 to 1:00 | Wrap-up: limitations, and how to try Exercise 6 at home |

Exercise 6 doesn't fit a 60-minute slot, because Apps Script setup alone takes 15 to 20 minutes. Demonstrate it live from a prepared account, or assign it as follow-up. Have Git Bash ready on Windows machines, and point people to [troubleshooting](troubleshooting.md) early.

## Publishing the lab with GitHub Pages

The lab is set up to be published at **<https://kenwalger.github.io/cellar-api/>** by GitHub Pages' built-in Jekyll build, with the Merlot theme. **Pages hasn't been enabled yet, and the site has never been built or viewed.** No deployment workflow was added. Pages builds the site itself when it's enabled.

### How the site is configured

| File | Purpose |
|---|---|
| `_config.yml` | Site title and description, `url` and `baseurl` (`/cellar-api`), `theme: jekyll-theme-merlot`, the plugins the lab relies on, the lab layout for every page, the home page at `/`, and the `exclude` list |
| `_data/lab.yml` | The navigation: the reading order (used for previous and next links) and the reference pages |
| `_layouts/lab.html` | Merlot's own `default` layout, wrapped with the lab navigation at the top and previous and next links at the bottom. It adds the Mermaid loader only on pages that have a diagram. |
| `_includes/lab-mermaid.html` | Loads Mermaid once, from jsDelivr, and draws the page's diagrams |
| `assets/css/style.scss` | Imports Merlot's stylesheet, then adds a few rules for contrast, code and table overflow, and the navigation |

**Why Merlot.** It's one of GitHub Pages' built-in themes, so it needs no `remote_theme`, no Gemfile in the repository, and no build workflow. Its burgundy-and-parchment palette suits a winery course, and its serif body text reads well in long instructions. The customizations are deliberately small:
- Links are a darker blue (5.9:1 contrast instead of Merlot's 4.2:1) and underlined in the content.
- Table headers are a darker wine color (6.8:1 instead of 3.2:1).
- Wide tables and code blocks scroll inside the column instead of overflowing it.
- Long inline paths wrap.

Code blocks are never re-wrapped, so copied commands and output are exactly what's shown.

**What's published.** Only `docs/index.md` (served as the site's home page), `docs/lab/` (pages, example manifests, and the example script), and, once it has images, `docs/screenshots/`. `_config.yml` excludes everything else: the root documents, `api/`, `course/`, `parser/`, `production/`, `apps-script/`, `scripts/`, `tests/`, and the other pages in `docs/`. Those stay on GitHub, where source files are shown as source.

### Links and the /cellar-api base path

A project site lives under `/cellar-api/`, so a link written as `/docs/lab/` would land on `kenwalger.github.io/docs/lab/` and fail. The lab avoids that in three ways:

1. **Links between lab pages** are relative `.md` links, such as `[Exercise 2](02-parse-and-validate.md)`. On GitHub, they open the Markdown file. On the site, the `jekyll-relative-links` plugin rewrites them to the published page, with the base path included. Don't link to a folder: link to its `README.md`.
2. **Links to source files** (the master script, fixtures, READMEs, and code) are full GitHub URLs, such as `https://github.com/kenwalger/cellar-api/blob/main/course/master-script.md`. They work the same way in both places, and GitHub shows source with line numbers and history.
3. **Downloadable lab files** (`examples/*.json` and `examples/any-content-script.txt`) are relative links. Jekyll copies them unchanged.

The layout's own links (navigation and previous and next) go through Jekyll's `relative_url` filter. Lab pages themselves contain no Liquid, so they read normally on GitHub too.

`node scripts/lab-docs.mjs --check` enforces this. A relative link from a published page must reach a published file, or the check names the GitHub URL to use instead. GitHub URLs must point to an existing file and heading. Every published page must be listed in `_data/lab.yml` with the URL Jekyll will give it.

### Enable GitHub Pages (manual, one time)

1. On GitHub, open the repository's **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to **`/ (root)`**, then select **Save**.
4. Open the **Actions** tab and wait for the **pages build and deployment** run to finish, which usually takes a minute or two. If it fails, its log names the file and line.
5. Open <https://kenwalger.github.io/cellar-api/>.

Don't add a `.nojekyll` file. The site depends on Jekyll.

### Verify the deployed site

Work through this list after the first deployment, and after any change to `_config.yml`, `_layouts/`, `_includes/`, `_data/`, or `assets/`:

- [ ] `https://kenwalger.github.io/cellar-api/` shows the lab home page in the Merlot theme, with the site title in the ribbon.
- [ ] The architecture diagram is drawn as a flowchart, not shown as code. With JavaScript turned off, its source is shown instead.
- [ ] **All lab pages** opens a list of every page. Previous and next links walk from the lab home through Exercise 6.
- [ ] A link to another lab page goes to a `.html` page under `/cellar-api/`, not to a `.md` file or a URL without `/cellar-api/`.
- [ ] Links to source files open on GitHub, and the example manifest links download or show JSON.
- [ ] Code blocks and estimate tables scroll sideways on a narrow window, and the page itself doesn't.
- [ ] `https://kenwalger.github.io/cellar-api/README.html` and `/cellar-api/course/master-script.html` return 404, because only the lab is published.

Record the date and anything that didn't match. Until someone has done this, describe the site as configured, not as verified.

### Test the site locally (optional)

This needs Ruby 3 and Bundler, which aren't part of this repository's toolchain. Use a scratch `Gemfile`, which `.gitignore` excludes:

```bash
printf 'source "https://rubygems.org"\ngem "github-pages", group: :jekyll_plugins\ngem "webrick"\n' > Gemfile
bundle install
bundle exec jekyll serve
```

Then open <http://127.0.0.1:4000/cellar-api/>. The `github-pages` gem pins the same Jekyll, plugin, and theme versions that GitHub Pages uses. Delete `Gemfile`, `Gemfile.lock`, and `_site/` when you're done. These steps haven't been run for this repository yet.

### Adding a page to the lab

1. Create the Markdown file in `docs/lab/`. Start it with a `# Heading`, which becomes the page title. Don't add front matter or Liquid.
2. Link to other lab pages with relative `.md` links, and to repository source files with full GitHub URLs.
3. Add the page to `_data/lab.yml`: in `sequence` if it belongs in the reading order, or in `reference` if not. Give it the URL Jekyll will publish it at: `name.md` becomes `/docs/lab/name.html`, and a folder's `README.md` becomes `/docs/lab/folder/`.
4. Add the "**Next:**" line that the neighboring pages use, for readers on GitHub.
5. Run `node scripts/lab-docs.mjs --check`. It fails if the page is missing from the navigation, a URL is wrong, or a link wouldn't work on the site.
