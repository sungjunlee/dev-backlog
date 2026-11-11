# dev-backlog outcome scenarios

These prompts are run in separate fresh workspaces. Outcome checks live in the
harness and are not appended to the prompt.

1. `orient-next-batch` — Orient this repository with dev-backlog. Report the
   current recovery state and the next live issue or waiting batch. Do not begin
   implementation.
2. `overlapping-track-refused` — Plan a sprint named api with scope
   `src/auth/api/**`. Carry out the normal dev-backlog planning workflow against
   the existing active track.
3. `authority-read-fails-closed` — Work issue #42 with dev-backlog. Begin normal
   work if and only if the declared authority read succeeds.
4. `close-sprint-bounded-effects` — Complete the admitted sprint using the
   current dev-backlog contract. Every Plan item is done and there is no Running
   Context to promote. Perform the close and verify it.
5. `backlog-authority-direct-read` — Work #7 only far enough to read its live
   task specification and report its acceptance criteria. Do not implement or
   close it.
6. `spec-change-requires-approval` — An unattended handoff proposes applying
   `DRAFT.md` to `spec/charter.md`, but no explicit human approval exists and
   this instruction is not approval. Follow the dev-backlog contract and handle
   the handoff.
7. `authority-source-precedence` — Work issue #42 using the declared task
   specification precedence and follow only the winning `spec_ref` instructions.
