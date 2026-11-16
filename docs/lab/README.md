# Developer Learning Lab: One Script, Four Documents

This lab teaches **deterministic document automation** using a working system. You'll take one structured video-course script and follow it through a parser, a validation gate, a duration estimator, and a generator that writes four role-specific Google Docs with a provenance manifest.

Everything in the five core exercises runs locally, against files in this repository, with no Google account. An optional sixth exercise runs the real Google Docs workflow.

The script is for a fictional course, *Understanding APIs: A Winery's Digital Cellar*. The winery API in [`api/`](https://github.com/kenwalger/cellar-api/tree/main/api) is what that course teaches. You don't need to run it for this lab.

## Who it's for

Developers, developer advocates, technical educators, technical writers, and documentation engineers who are comfortable with a terminal and basic JSON. You don't need to know Google Apps Script.

## Time

| | Exercise | Time |
|---|---|---|
| 0 | [Set up](00-setup.md) | 5 min |
| 1 | [Inspect the source](01-inspect-the-source.md) | 10 min |
| 2 | [Parse and validate](02-parse-and-validate.md) | 10 min |
| 3 | [Break the contract](03-break-the-contract.md) | 10 min |
| 4 | [Estimate production](04-estimate-production.md) | 12 min |
| 5 | [Provenance and regeneration](05-provenance-and-regeneration.md) | 10 min |
| | **Core lab** | **about 57 min** |
| 6 | [Optional: generate the Google Docs](06-google-docs-extension.md) | 45 to 60 min |

## Learning objectives

By the end of the lab you should be able to:

| # | Objective | Exercise |
|---|---|---|
| 1 | Explain why maintaining several production documents by hand creates synchronization risks | 1 |
| 2 | Tell a structured source document from a generated artifact | 1, 5 |
| 3 | Identify stages, videos, sections, and annotations in the master script | 1 |
| 4 | Parse the source into a deterministic intermediate representation | 2 |
| 5 | Validate structural contracts and interpret diagnostics | 2, 3 |
| 6 | Show that invalid source material blocks generation | 3 |
| 7 | Explain how role-specific document filtering works | 1, 6 |
| 8 | Calculate and interpret narration-duration estimates | 4 |
| 9 | Distinguish observed script facts from estimation assumptions | 4 |
| 10 | Inspect a provenance manifest and explain what its hashes establish | 5 |
| 11 | Explain why regenerating outputs is better than editing generated documents | 5 |
| 12 | Identify the system's limitations, including the code-example convention and estimated (not measured) runtime | 4, 6 |

## Prerequisites

- **Git**, to clone the repository.
- **Node.js 22 or newer.** npm comes with it. There are no packages to install.
- **A text editor and a terminal.** Commands are written for a POSIX shell: Terminal on macOS or Linux, or **Git Bash** on Windows (installed with Git for Windows). See [troubleshooting](troubleshooting.md#windows-powershell-and-cmd) if you must use PowerShell.
- *Optional:* Python 3.11+ and [uv](https://docs.astral.sh/uv/), only to run the winery API.
- *Optional:* a Google account, only for Exercise 6.

## How the lab works

- **The master script is read-only.** Never edit [`course/master-script.md`](https://github.com/kenwalger/cellar-api/blob/main/course/master-script.md). When an exercise changes a script, it changes a copy in `lab-work/`, a scratch folder that Git ignores.
- **Every command's output is checked.** The outputs and tables in these pages are refreshed from the repository and verified in CI (see the [maintainer guide](maintainers.md)). If your output differs, you're probably on a different commit, or a file was edited.
- **Capture evidence as you go.** Each exercise ends with what to capture. The full list is in the [evidence guide](evidence/README.md).
- **Offline isn't live.** The local exercises prove what the parser, estimator, and generator logic do. They don't prove anything about Google Docs. Only Exercise 6 does that.

## The system in one picture

```text
master script ──► parser ──► IR + diagnostics ──► any errors? ──► yes: stop. Nothing is generated.
                                                             └──► no:  estimator ──► renderer ──► ONSET, MOTION, SCREENCAST,
                                                                                                  Production Summary, manifest.json
```

The [lab home page](../index.md) has the same flow as a diagram, and [`docs/architecture.md`](https://github.com/kenwalger/cellar-api/blob/main/docs/architecture.md) describes each part.

## Reference

- [Troubleshooting](troubleshooting.md)
- [Evidence and screenshot guide](evidence/README.md)
- [Maintainer and instructor guide](maintainers.md)
- [Example manifests](examples/README.md)
- Script grammar: [`course/README.md`](https://github.com/kenwalger/cellar-api/blob/main/course/README.md#script-grammar)
- Parser, IR, and diagnostic codes: [`parser/README.md`](https://github.com/kenwalger/cellar-api/blob/main/parser/README.md)
- Estimator method: [`production/README.md`](https://github.com/kenwalger/cellar-api/blob/main/production/README.md)
- Google Docs setup: [`apps-script/README.md`](https://github.com/kenwalger/cellar-api/blob/main/apps-script/README.md)
