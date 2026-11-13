# Contributing

Thanks for your interest. This repository is mainly a teaching resource, so readable changes are worth more than clever ones.

## Development setup

1. Install Python 3.11+ and [uv](https://docs.astral.sh/uv/).
2. Clone the repository and run:

   ```bash
   uv sync
   uv run pytest
   ```

3. Start the API with `uv run uvicorn api.main:app --reload`.

## Branches and pull requests

- Branch from `main` and use a short, descriptive branch name, such as `fix-404-message` or `docs-readme-examples`.
- Keep each pull request to one change. Small, focused PRs are easier to review and easier for learners to follow in the history.
- Fill in the pull request template. Say what changed, why, and how you checked it.
- Link the related issue if there is one.

## Tests and formatting

Before you open a pull request, run:

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

CI runs the same commands. New behavior needs tests, and tests must not depend on a running server, the network, or a database.

## Documentation

If your change affects behavior, commands, or project scope, update the docs in the same PR: `README.md`, `CLAUDE.md`, the relevant file in `docs/`, and the Unreleased section of `CHANGELOG.md`. Documentation should describe what exists. Label future work as planned.

## Keep it small

Please don't add infrastructure the project doesn't need, such as databases, authentication, containers, cloud services, AI integrations, or new frameworks. If you think something like that is worth adding, open an issue to discuss it first.

## Reporting bugs

Open an issue using the bug report template. Include the steps to reproduce, what you expected, what happened, and your Python and OS versions. For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

By taking part, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
