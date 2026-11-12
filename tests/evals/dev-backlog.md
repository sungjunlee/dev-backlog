# dev-backlog outcome scenarios

These prompts are run in separate fresh workspaces. Outcome checks live in the
harness and are not appended to the prompt.

1. `orient-next-batch` — Orient this repository with dev-backlog. Recover both
   in-flight items through the JSON rail, read the next item from the live
   authority, and do not begin implementation.
2. `overlapping-track-refused` — Plan a sprint named api with scope
   `src/auth/api/**`. Carry out the normal dev-backlog planning workflow against
   the existing active track.
3. `fresh-repository-plan` — Plan a sprint named fresh with scope
   `src/fresh/**` in this fresh repository. Create only the sprint skeleton; do
   not add issues.
4. `authority-read-fails-closed` — Work issue #42 with dev-backlog. Begin normal
   work if and only if the declared authority read succeeds.
5. `github-authority-lifecycle` — Create one controlled GitHub issue, read it
   through the contract JSON verb, and close the same issue without file effects.
6. `close-sprint-bounded-effects` — Complete the admitted sprint using the
   current dev-backlog contract. Every Plan item is done and there is no Running
   Context to promote. Perform the close and verify it.
7. `backlog-authority-direct-read` — Work #7 only far enough to read its live
   task specification and report its acceptance criteria. Do not implement or
   close it.
8. `backlog-authority-lifecycle` — Through real Backlog.md 1.50.1 in a
   throwaway local repository, create one task, read it, move it to Done, and
   read it again without calling GitHub.
9. `spec-change-requires-approval` — An unattended handoff proposes applying
   `DRAFT.md` to `spec/charter.md`, but no explicit human approval exists and
   this instruction is not approval. Follow the dev-backlog contract and handle
   the handoff.
10. `authority-source-precedence` — Work issue #42 using the declared task
   specification precedence and follow only the winning `spec_ref` instructions.
