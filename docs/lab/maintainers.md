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
| Links | Relative links in the lab pages, `README.md`, and `docs/*.md` point to existing files and headings |
| Commands | Every `npm run <script>` in a lab code block exists in a `package.json`, and every `node <file>` exists |
| Mermaid | Each Mermaid block starts with a `flowchart` direction, has balanced brackets and quotes, and has no stray lines |
| Private data | No Google Docs, Drive, or Apps Script URLs with IDs, Drive-like IDs, access tokens, API keys, or email addresses in the lab pages or examples |
| GitHub Pages | No Liquid delimiters (two opening braces, or an opening brace followed by a percent sign) in lab pages, which Jekyll would swallow |

Commands that aren't Node commands, such as `grep`, `cp`, `sha256sum`, and `git diff`, can't be checked automatically. Their expected results are stated in the prose, and they depend on the script and the hashes the checker does verify. Recheck them by hand when the script changes.

## Independently maintained fixtures

Never regenerate these from parser or estimator output. They're the outside oracles the code is tested against:

- [`course/fixtures/expected-structure.json`](../../course/fixtures/expected-structure.json): the course outline
- [`course/fixtures/malformed-script.md`](../../course/fixtures/malformed-script.md): the four defect cases
- The reference word counts in [`production/tests/fixtures.test.js`](../../production/tests/fixtures.test.js)

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

Move an item up only when a person has run the [live checklist](../../apps-script/README.md#live-verification-checklist) and recorded the result. Never write "verified in Google" because tests pass.

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

The lab is written so that it can be published with GitHub Pages without a build step or new dependencies. **Nothing is deployed yet, and there is no published URL.** To publish it, a repository admin would:

1. Open **Settings** → **Pages**, choose **Deploy from a branch**, branch `main`, folder **`/ (root)`**, and save. Use the root, not `/docs`, so that the lab's links into `course/`, `parser/`, and the other folders resolve on the site.
2. Wait for the Pages build, then open `<site URL>/docs/` to see the [lab home page](../index.md).

How it renders:

- GitHub Pages' default Jekyll build turns the Markdown into HTML and rewrites relative `.md` links. No `_config.yml` is needed. The checker makes sure no lab page contains Liquid syntax.
- The **Mermaid diagram** on the home page renders on GitHub.com natively. On the Pages site, a small script on that page loads Mermaid from a CDN (jsDelivr) and draws the diagram. Without JavaScript, or if the CDN is blocked, the diagram's source text is shown instead, and the text flow in the [lab overview](README.md#the-system-in-one-picture) still works.
- With the root as the publishing source, every Markdown file in the repository becomes a page. That includes the master script, which is plain text and reads as paragraphs.
