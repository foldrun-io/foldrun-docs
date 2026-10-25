# Three flow patterns: model fallback, early stop, best-of

*Proposal, 2026-10-11. Status: planned, nothing built. One feature per
session, in this order: A, then B, then C. Each ships through every layer
(API → dashboard → CLI → docs → tests → commit and push) before the next
starts.*

Compared against Anthropic's "Building effective agents" (prompt chaining,
routing, parallelization by sectioning and voting, orchestrator-workers,
evaluator-optimizer, autonomous agents), foldrun covers every pattern but
one. Voting (best-of-N) is missing. Two reliability gaps sit beside it.

| | Today | After |
|---|---|---|
| A. a step's model tier is refused (Opus weekly cap) | the step fails, or moves to a *second supply* if one is configured | it can finish on a cheaper tier **of the same supply**, declared with `fallback-model:` |
| B. a step finds there is nothing to do | every later step needs its own `when:` or it runs anyway | `stop-if:` ends the run there as a success |
| C. a step whose quality matters most | one attempt, or three hand-written steps plus a picker | `attempts: 3` + `pick: judge: …` runs N and keeps the best |

---

## A. `fallback-model:`: a cheaper tier on the same supply

### Why

One Claude subscription runs every desk. The plan has a separate weekly cap
for Opus. When it is spent, every `model: max` step fails until 5am Sydney,
while `default` (Sonnet) steps beside them still run (2026-09-21). The
existing fallback (`isProviderRefusal` → `secondSupply` in
`foldrun-core/src/runner.ts`, the provider block's `fallback:` and
`FOLDRUN_FALLBACK_*`) moves a refused step to a **different provider**. The
owner has chosen not to have one, and no desk uses OpenRouter. Nothing
retries on a lower tier of the supply that is still working.

### Grammar

```markdown
---
model: max
fallback-model: default      # flow-wide default
---
1. [[writer]] — Draft it.
   model: max
   fallback-model: default   # per step; wins over the flow's
```

Also in an agent's frontmatter, using that file's key spelling (check how
`permissionMode`, `disallowedTools` and `max_turns` are spelled, and follow
the house rule for each file). Precedence is exactly `model:`'s: step, then
flow, then agent, then account default. Values are `fast | default | max`.
Optionally a list, tried in order (`[default, fast]`), at most 2.

### Behaviour

1. It applies only to a refusal that `isProviderRefusal()` accepts and
   `isTransientOverload()` rejects: the window or quota is spent, not
   momentarily busy. A transient overload keeps its existing backoff
   retries. A failure of the work itself never falls back.
2. Order: **same-supply lower tier first**, then the existing second supply
   (if any). Falling back is cheaper, and it is what a single-supply
   account can do.
3. It obeys the existing re-drive safety rule: no fallback if the step can
   act outward and a tool already ran in the attempt
   (`dropRetrySafe` / `actedThenFailedCheck`).
4. Never upward: a fallback tier above the primary is a `check` error.
   `fallback-model` equal to `model` is a check warning.
5. The trace says it out loud. The refusal line ends with a new state,
   `trying default on the same supply` (beside the three existing states in
   `providers.md` "Where the step can go next"). The step record gets
   `model.requested`, `model.ran` and `model.fallbackReason`. The ledger and
   billing use the model that actually ran.
6. A fallen-back step is still a success. Its outcome carries a
   `fellBack: true` flag so the run page and `observe` can count them.

### Layers

- **API (core + platform):** parse and validate the option
  (`flow-lint.ts`, the step-option parser in core, `completions.ts`
  `STEP_OPTIONS`). Then the runner path above, the record fields, and
  `GET runs/<id>` exposing them. Update OpenAPI (the web OpenAPI
  completeness test must stay green).
- **Dashboard (foldrun-web):** a "fallback" field in the canvas step
  inspector and on the flow settings. A "ran on default (max refused: weekly
  limit)" badge on the step in the run page. A count on Observe.
- **CLI (foldrun-cli):** `foldrun check` errors and warnings, a mark on
  the step in `foldrun flow show`, the line in `foldrun runs <id>` /
  `report`, and `foldrun flow add <flow> fallback` if it fits the pattern
  list. A `docs/cli.md` row and tests.
- **Docs:** see "Docs to update" below.

### Done when

A deployed test flow with `model: max`, `fallback-model: default` runs on
the box, the max call is refused (forced in a test with a stub that returns
the real weekly-limit sentence, and in unit tests with the 2026-09-21
text), and the step finishes on default with the trace line, record fields,
badge and CLI line all showing it.

---

## B. `stop-if:`: end the run early, as a success

### Why

A daily flow often finds "nothing new today" in step 1. Today every later
step needs its own `when:` marker, or it runs on nothing. That is easy to
forget, and a forgotten one costs a full run or posts an empty digest.

### Grammar

```markdown
1. [[checker]] — Is there anything new? Start a line with NOTHING if not.
   stop-if: NOTHING
2. [[writer]] — …
```

- `stop-if: <MARKER>`: a line of this step's result begins with it (the
  same matching as `when: <MARKER>`, sharing its code).
- `stop-if: no rows of <path>`: the CSV has no data row (the inverse of
  `when: rows of`, sharing its code).

### Behaviour

- The run ends after this step's group finishes, with status **succeeded**
  and outcome **stopped early**. Each remaining step is recorded as skipped
  with `stopped early by step N (NOTHING)`. A parallel group finishes
  together: `stop-if` on one member stops after the whole group.
- Approval steps after the stop are not asked. `notify:` fires as for a
  success, worded "stopped early: <marker line>".
- `check`: `stop-if` on the last step is a warning (nothing to stop).
  `stop-if` together with `each:` is an error until someone defines what it
  means.
- `rerun` from a later step ignores an earlier stop (the person chose where
  to start).

### Layers

The same four layers. The dashboard shows a "stops if …" mark on the canvas
step and a "stopped early at step N" banner on the run. The CLI `flow show`
draws the exit and `runs` shows the outcome. A `stop` pattern goes in
`flow add`.

### Done when

On the box, a flow whose step 1 replies `NOTHING` ends green after step 1,
with the remaining steps skipped and named, no approval asked, and the
notify sent. The same flow without the marker runs every step.

---

## C. `attempts:` + `pick:`: best-of-N (Anthropic's "voting")

### Grammar

```markdown
2. [[writer]] — Draft the post.
   attempts: 3                         # 2–5
   pick: judge: the most specific, accurate draft with every source cited
   models: [max, default, default]     # optional: vary the tier per attempt
```

### Behaviour

- N attempts run **in parallel**, each in its own sandbox, from the same
  inputs. Each attempt's file changes are held apart. Only the winner's are
  written back to the workspace and its reply becomes the step's result.
  The losers' files are discarded, and their replies are kept on the trace.
- `pick: judge:` reuses the existing `verify: judge:` grader. It sees every
  attempt's reply (and the files each wrote, as context), returns the
  winner and a one-line reason, and both are recorded. A `verify:` on the
  step then runs against the winner only.
- If every attempt fails, the step fails. If only one succeeded, it wins
  without a judge call.
- **Refused on an agent that can act outward** (a `check` error): N
  attempts would send N times. The same rule as the outward gate.
- Cost is N attempts plus the judge. The run's cost line itemises them.

### Layers

The same four layers. The dashboard shows "best of 3" on the canvas step,
and on the run page all attempts side by side with the winner marked and
the judge's reason. The CLI `flow show` marks it, `runs <id>` lists
attempts and the winner, and a `best-of` pattern goes in `flow add`.

### Done when

On the box, a flow with `attempts: 3` runs three sandboxes. The run page
shows three replies, the winner and the reason. Only the winner's files
are in storage afterwards. An outward agent with `attempts:` fails
`foldrun check`.

---

## Docs to update (every feature, in the same commits)

Each feature is unfinished until all of these say the same thing:

1. **foldrun-docs**
   - `flows.md`: the step-options table, plus a short section with an
     example.
   - `agents.md`: the frontmatter key (A only).
   - `providers.md`: "Where the step can go next" gets the new state and the
     fallback order (A).
   - `runs.md`: new record fields and outcomes (`fellBack`, `stopped early`,
     attempts and winner).
   - `api.md`: the new fields on `GET runs/<id>` and anything new in flow
     PATCH.
   - `cli.md`: rows for every new verb or flag and for `flow add` patterns.
   - `glossary.md`: fallback model, stopped early, best-of.
   - `troubleshooting.md`: "my max steps ran on default", "my run stopped
     after step 1".
2. **The CLAUDE.md templates:** `foldrun-core/src/starter.ts` (what
   `foldrun init` writes) and `/Users/mine/foldrun/CLAUDE.md`, the
   step-options table in both.
3. **The CLI's managed AGENTS.md block:** `foldrun-cli/src/guide.mjs`.
4. **Editor completions:** `foldrun-core/src/completions.ts`
   `STEP_OPTIONS` (and the agent frontmatter list for A).
5. **Sync:** `node scripts/sync-docs.mjs` in `foldrun-cli`, then commit
   `foldrun-cli/docs/`.
6. **Release notes:** what `/api/changelog` reads, if a dated entry is the
   convention there.
7. **This proposal:** set its status line and add a "What was built" section
   with the commits, as `browser-automation-frontmatter.md` does.

## Rules every session follows

- Feature order: API → dashboard → CLI → docs → tests → commit and push.
  Nothing is done with a layer missing.
- Verify first: read the existing code paths named above before writing.
  Several already exist (`isProviderRefusal`, `secondSupply`, `when:`
  matching, the judge grader).
- One supply is a choice: A never reaches a second provider that is not
  configured, and never adds OpenRouter or any new provider.
- Core changes must also pass `foldrun-web`'s typecheck (the box deploy runs
  it; core's own hooks do not).
- Commit by explicit path. Leave other sessions' uncommitted files alone.
  Never bypass the git hooks (`SKIP_HOOKS`, `--no-verify`).
- Shipped means verified live on the box (dev.foldrun.io) with a real flow,
  not merely pushed. Say plainly what was and was not verified.
- If core's or the CLI's npm package must change, bump the CLI's
  `@foldrun/core` dependency before merging its release PR (the release
  tests against npm core).
- Track it in Linear (team FOL): one issue per feature, closed with the
  commits and the live evidence.
