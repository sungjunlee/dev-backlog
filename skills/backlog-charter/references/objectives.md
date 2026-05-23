# Objective Predicates: Good vs. Bad

Use this reference in `backlog-charter` create mode (or amend, when adding objectives) to write Tier 2 entries that survive their own proof gate. An Objective is a **verifiable predicate** — a statement that can be checked true or false against the world, not a task to do or an aspiration to feel good about.

The shape:

> `O<n> [status]    <verifiable predicate> · src: <user|inferred|execution>`

The predicate should map to a verification path you could write down today: a command to run, a scenario to walk through, a count to take. If you cannot name the verification, the predicate is not yet verifiable — sharpen it before committing it to CHARTER.

## ✅ Good Predicates

Each example pairs a predicate with the concrete check that would advance its status to `validated`.

1. **"A user can pull open GitHub issues into `backlog/tasks/` without API tokens beyond `gh auth`"**
   *Verification:* run `node scripts/sync-pull.js` against a fresh repo; assert `backlog/tasks/*.md` exists and no token was prompted. A scenario predicate with a runnable check.

2. **"An agent resuming a sprint mid-session sees in-flight `[~]` items it did not author and can act on them without re-asking the user"**
   *Verification:* open the active sprint file in a fresh session; confirm `[~]` markers + PR refs are readable. A continuity predicate verified by a single observation.

3. **"A user can answer 'is this project still on track?' in under 5 minutes against `CHARTER.md`"**
   *Verification:* timed read + answer against the live CHARTER. Mixed-rigor: not a script, but a timed scenario with a binary outcome. (This is dev-backlog's own O3.)

4. **"Every open Issue maps to an active or deferred Objective without manual triage"**
   *Verification:* `backlog-triage` Alignment Check report shows 0 orphans on the current backlog. A drift predicate with an existing tool as the check.

5. **"A new contributor reads `CHARTER.md` in under 5 minutes and can name one explicitly rejected scope"**
   *Verification:* word count + Non-Goals section non-empty + onboarding scenario. Cheap to observe; sharper than "CHARTER is short."

Notice the shape: each one names **who** does **what** with a **measurable outcome**. None of them say "improve" or "implement."

## ❌ Bad Predicates (and How to Rewrite Them)

Each failure mode appears regularly. The rewrite shows the move that fixes it.

1. **"Improve sync performance"**
   *Failure:* vague aspiration — no threshold, no observation point.
   *Rewrite:* "`sync-pull` of 100 open issues completes in under 5s on a warm cache." Add a threshold + a fixture.

2. **"Implement OAuth"**
   *Failure:* a task, not an outcome. Closes when shipped, not when verified.
   *Rewrite:* "A user signs in with Google and reaches their dashboard within one click of the login button." Move from build-it to user-observes-it.

3. **"Better DX"**
   *Failure:* unfalsifiable opinion. Whose DX, doing what, judged how?
   *Rewrite:* "An agent dispatches a relay run with one command and no manual edits to manifest files." Name the actor, the action, the observable.

4. **"Adopt CHARTER everywhere"**
   *Failure:* process declaration, not a user-facing outcome. Confuses the project's internal habit with what the project produces.
   *Rewrite:* "Every active project in this workspace has a committed `CHARTER.md` at repo root." Make it a count, not a vibe.

5. **"Reduce context loss across sessions"**
   *Failure:* direction without verification — true when? observed by whom?
   *Rewrite:* "An agent reading only `_context.md` + the active sprint file resumes the previous session's in-flight work without asking the user." Bind the claim to a single scenario with a binary outcome.

## Common Rewrite Patterns

When a draft objective feels off, ask which pattern applies:

| If the draft is... | The fix is... |
|--------------------|---------------|
| Vague aspiration ("improve", "better") | Add a threshold or a binary observation. |
| A task ("implement X") | Restate as what the user observes when X exists. |
| An opinion ("better DX") | Name actor + action + observable. |
| A process declaration ("adopt Y") | Convert to a count or coverage statement. |
| A direction ("reduce Z") | Bind to a single scenario with a yes/no outcome. |

## The 30-Second Test

Before committing a new Objective, read it aloud and answer: *what would I look at, right now, to decide if this is true?* If the answer is "I don't know" or "it depends on who you ask," the predicate is not yet ready. Sharpen, then commit.
