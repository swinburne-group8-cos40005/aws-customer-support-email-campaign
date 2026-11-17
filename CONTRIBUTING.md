# Contribution conventions

How commit messages and pull request titles are written in this
repository. The goal: any line of history can be scanned in seconds and
tied back to the issue it implements.

## Commit messages

```
<type>(<optional scope>): <subject> (#<optional issue>)
```

### Types

| Type | Use for |
| --- | --- |
| `feat` | new capability — an endpoint, an infra stack section, a page |
| `fix` | bug fix |
| `docs` | documentation only (`.md`, comments, ADRs) |
| `style` | formatting, naming, import order — zero logic change |
| `refactor` | code change that neither adds a feature nor fixes a bug |
| `test` | adding or correcting tests |
| `build` | dependencies, build or tooling configuration |
| `chore` | maintenance — assets, cleanup, repo housekeeping |
| `perf` | performance improvement |
| `ci` | CI workflow configuration |

### Scope

The scope names the area touched. Prefer the repo area
(`infra`, `backend`, `frontend`, `db`, `docs`, `ci`) or, for backend
code, the layer (`config`, `db`, `utils`, `repositories`, `services`,
`schemas`, `http`, `controllers`, `handlers`). For infra, the stack or
file (`api`, `data`, `artifact`, `observability`, `messaging`,
`dashboards`) works too.

### Subject rules

- Imperative mood: "add campaign status filter", never "added" or "adds".
- Lowercase first word, no trailing period, at most ~72 characters.
- Reference the issue in the subject as `(#N)` when the commit
  implements it (fully or partially).
- The body (optional) explains **why** the change exists — the diff
  already shows how. Wrap body lines at 72 characters.

### Examples

```
feat(api): artifact stack for deployable evidence (#31)
fix(middleware): degrade to 401 when the authorizer context is absent
test(repositories): cover campaign insert/mapper, catalog probes, audit writes
style: blank line between import groups, three blank lines before declarations
build(deps): add zod + @aws-sdk/rds-signer for schema validation and IAM DB auth (#5)
```

## Pull request titles

```
<type>(<scope>): <summary> (Issue #N)
```

- **One PR per issue.** The title always ends with `(Issue #N)` — no
  exceptions, so the issue link is visible without opening the PR.
- The scope is the repo area: `infra`, `backend`, `frontend`, `docs`,
  `db`, `ci`.
- The summary follows the same subject rules as commits (imperative,
  no trailing period, ~72 characters).
- The PR body uses `.github/PULL_REQUEST_TEMPLATE.md`; the issue is
  linked with `Closes #N` in the Summary section.

### Examples

```
feat(infra): artifact stack for deployable evidence (Issue #31)
feat(backend): layered rewrite of POST /campaigns (Issue #5)
fix(infra): pin nodejs20.x runtime warning in api.yaml (Issue #29)
docs(conventions): commit message and PR title principles (Issue #36)
```

## Branch naming

```
<type>/<topic>-issue<N>
```

Examples: `feat/api-campaign-create-issue5`,
`feat/artifact-yaml-issue31`, `docs/commit-pr-conventions-issue36`.
