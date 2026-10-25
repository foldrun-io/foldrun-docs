# ADR: where the flow grammar stops

Written 2026-08-29, after counting. This is a limit, not a plan — it says what
the format will NOT grow, and why the pressure to grow it will feel reasonable
every single time.

## The count

A flow step accepts seventeen options today, parsed in `store.ts`:

| what it does | keys | n |
|---|---|---|
| control flow | `when` `case` `else` `loop` `until` `each` `max` | 7 |
| failure handling | `retry` `timeout` `on-fail` | 3 |
| human gates | `approve` `ask` | 2 |
| per-step config | `model` `effort` | 2 |
| delegation | `delegate` | 1 |
| timing | `wait` | 1 |
| assertion | `verify` | 1 |

Plus line syntax (group number, `?`, `[[agent]]`, `[[flow:name]]`) and seven
flow frontmatter keys — about twenty-four pieces of vocabulary in total.

**Ten of the seventeen are control flow and failure handling.** That is most of
a workflow engine's vocabulary, and no one added it on purpose: each key
arrived as a reasonable answer to a real flow that needed it.

## The line

**No variables. No templating. No expression evaluation.**

`case: BUG` matches text. It does not compare, coerce, interpolate or evaluate.
The day `case:` needs to compare a number, this format has started being a
programming language, and a bad one — every workflow YAML that grew `${{ }}`
took the same first step for the same good reason.

Concretely, the format will not grow:

- `${...}` or `{{...}}` in any position
- comparison or arithmetic in `case:` / `when:`
- references to earlier steps' fields (`steps.1.output.url`)
- a value in a bound: `max:` and `loop:` take literals, never expressions

## Why this format specifically can refuse

Airflow, n8n and GitHub Actions grow expression languages because their steps
are dumb — a shell command, an HTTP call. The step cannot reason, so the config
has to, and every conditional in the world ends up in YAML.

Here every step is an agent that reads the previous results and thinks. The
branching intelligence lives in the instruction, in prose, which is more
expressive than any DSL we would write. `case: BUG` is not a weak `if`; it is a
marker a model was *asked to emit*. Adding an expression language would be
building a second, much worse reasoner beside the good one.

## Where the pressure will come from, and the answer

**"I need to branch on a number."** Money, refunds, thresholds, compliance —
cases where a model's text match is genuinely not good enough, and the person
asking is right about that. The answer is `verify:`, which runs a shell command
and fails the step on a non-zero exit: real code, in a real language, testable
and diffable. Arithmetic belongs in a script; judgement belongs in the
instruction; neither belongs in frontmatter.

**"I need step 3 to use the URL step 1 found."** This one is a real weakness —
today the value is re-extracted from prose, which is lossy and costs tokens.
The answer is NOT variables. If it ever hurts enough, the narrow move is
structured step output (a step declaring it returns JSON), and even that should
wait for a flow that genuinely bleeds, because it is the same slope with better
manners.

## What the bounds buy, and must keep buying

`retry` clamps to 5, `loop` to 5, `max` to 20, `delegate` to 5 — in the parser,
not by convention. So the worst-case cost of a flow is readable off the file
without running it. That property is why this can be billed per step and why a
flow can be reviewed like a document.

A bound that took an expression would end it. That is the real reason `max:`
takes a literal.

## The test to apply

When a new step option is proposed, ask: **is this judgement, or is this
arithmetic?**

- Judgement → the agent's instruction. No new key.
- Arithmetic → `verify:` or a script. No new key.
- Neither, and it is genuinely about *orchestration* (when a step runs, how
  often, who releases it) → it may deserve a key, and the count goes to
  eighteen with someone having said so out loud.

The failure mode this guards against is not one bad decision. It is seventeen
good ones.

## Addendum, 2026-09-02: eighteen, and the one the ADR predicted

The count went to eighteen. `output: json` is the "narrow move" named above —
a step declaring it returns JSON — and it was taken deliberately, out loud,
because handing a URL from step 1 to step 3 through prose was costing tokens
and losing characters on every flow with a list in it. It stays on the right
side of the line: the step declares a *shape*, the runner parses the value,
`each: items` fans out over it, a shell `verify:` reads it on stdin. Nothing
in the file evaluates, compares or interpolates. `${…}` still does not exist.

Two things changed that are not new keys. `verify:` accepts the eval file's
assertion words, so a flow and an eval say the same sentence; and `wait:`
accepts `event`, which is orchestration in the sense above — *who releases
the step* — under a key that already existed.
