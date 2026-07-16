# Windows Portability Design

## Context

`dev-backlog` advertises cross-platform use, but the supported workflow is only
verified on Ubuntu. A default Windows Git checkout converts tracked LF files to
CRLF, Node exposes native `\\` paths, and Bash launched from Windows cannot use
untranslated drive-letter paths. The result is a green Linux CI build and a
broken Windows maintainer/user workflow.

## Decision

Make Windows a first-class supported execution path instead of narrowing the
product claim or documenting workarounds.

The fix has three boundaries:

1. Repository text policy: track shell scripts as LF with `.gitattributes`.
2. Public contract policy: serialize platform-neutral repo-relative paths with
   forward slashes while retaining native paths for filesystem access.
3. Process policy: translate native paths only when crossing from Node into
   Bash, then verify the contract in a Windows CI job.

## Alternatives Rejected

- Document WSL-only use. This contradicts the existing Windows/Codex use case
  and leaves Node-side path contracts platform-dependent.
- Add a local setup command that rewrites line endings. This is easy to forget,
  mutates every checkout, and does not protect CI or consumers.
- Normalize every internal path globally. Filesystem APIs should keep native
  paths; only serialized output and Bash process boundaries need conversion.

## Implementation Shape

- Add `.gitattributes` rules for shell scripts and stable text files.
- Add a small path-contract module owning repo-relative serialization and
  Bash-path conversion. Do not scatter replacement expressions across scripts.
- Pin failing Windows cases with tests before changing production behavior.
- Update Bash-spawning acceptance tests to cross the process boundary through
  the path-contract module.
- Add a Windows CI job alongside the existing Ubuntu job.
- Document the tested Windows shell/runtime expectation in the maintainer
  verification section.

## Error Handling

Path conversion must fail clearly for unsupported inputs rather than returning
a path that Bash cannot resolve. JSON output remains deterministic and uses `/`
for platform-neutral repo-relative fields.

## Verification

- Full Node test suite passes on Windows.
- Bash smoke suite passes from a normal Windows checkout.
- Ubuntu CI remains green.
- Windows CI runs both commands and is green.
- A fresh checkout reports LF shell worktree files under `git ls-files --eol`.

