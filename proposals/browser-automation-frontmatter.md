# Choosing the browser stack from frontmatter

*Proposal, 2026-09-20. Status: steps 1 and 2 done 2026-09-21 — see "What
was built" at the end. Step 3 waits on BiDi or a vendor; step 4 is not
planned. The 2026-09-23 comparison against agent-browser, Playwright MCP,
BrowserQL and Stagehand, and what it led to, is at the very end.*

The ask: let an agent author choose the browser automation library, the
protocol it speaks, and the vendor — the way they already choose the engine.

The short answer: **one of those three is worth exposing, one is already
exposed, and one would cost a rewrite and buy nothing.** What the request is
really reaching for is a fourth thing, and that one is worth building.

## The four layers, and which belong in frontmatter

| layer | example values | expose? |
|---|---|---|
| hosted browser service | browserbase · steel · browserless · brightdata | **already** (`via:`) |
| automation library | Playwright · Puppeteer · agent-browser | **no** |
| protocol | CDP · WebDriver BiDi · WebDriver Classic | **narrowly, later** |
| engine | chromium · firefox · webkit | **already** (`engine:`) |

### Vendor — done

`web_browse: browserbase`, or `via:` inside the block. Six vendors in
`BROWSER_APIS` (`foldrun-core/src/providers.ts:233`). Nothing to add.

### Engine — done, with a naming wart to fix

`engine:` takes `chrome | firefox | safari`, aliased to
`chromium | firefox | webkit` (`providers.ts:443`). But the per-call argument
is `browser:` and takes only the *engine* spellings. Two names for one thing,
and only one of them accepts the friendly aliases.

**Fix:** accept `BROWSE_ENGINE_ALIASES` in the call argument too, and let
`engine:` be a synonym for `browser:` on the call. One vocabulary, both places.
Cheap, and removes a real stumble.

### Library — do not expose

This is the one to push back on. `web_browse` is not a thin wrapper: it is
~30 arguments, ~20 actions and 8 modes (`foldrun-docs/tools.md`), implemented
once against Playwright in the gallery wrapper (`foldrun-platform/src/gallery.ts:63`).

`library: puppeteer` would mean reimplementing every action and every mode a
second time, then keeping two implementations honest against each other
forever — and the author sees *no difference*, because the tool's surface is
ours, not the library's. They would be choosing which of our two codepaths has
today's bug.

The library is an implementation detail on purpose. Anyone who genuinely needs
Puppeteer's own API has a better door already: a `scripts:` entry with
`runtime: { packages: [puppeteer] }`, where they write Puppeteer directly and
we stay out of it.

> Rule of thumb: expose a choice when the author can see the difference in the
> result. Library choice fails that test; engine and vendor pass it.

### Protocol — narrowly, and not yet

CDP versus WebDriver BiDi is *nearly* invisible for the same reason, since
Playwright abstracts it. Three things could make it visible later:

1. **Firefox has no CDP any more** — deprecated in 129, removed in 141. That
   affects Puppeteer and Selenium users; it does not touch us, because
   Playwright drives its own patched Firefox over Juggler, its own protocol,
   not BiDi and not CDP. (Corrected 2026-09-23: this line used to say
   "driving Firefox already means BiDi underneath", which is wrong for
   Playwright.)
2. **BiDi covers ~70% of CDP's surface.** Some of our actions may have no BiDi
   equivalent yet; a `protocol:` switch that silently disables `capture` or
   `trace` would be a bad bargain.
3. **A vendor may speak only its own** — Browserless's BQL, reached through
   their BAP SDK, is not CDP. If we ever wanted their stealth engine rather
   than their plain Chrome, that is a protocol choice wearing a vendor's name.

**Recommendation:** no `protocol:` key now. Revisit when (2) resolves or when a
vendor forces it. If it lands, it belongs in the block beside `engine:`, values
`cdp | bidi`, defaulting to whatever the engine requires, and `check` must
refuse the combinations that lose features rather than discovering them at 3am.

## What the request is actually reaching for

agent-browser is not interesting because it is Rust or because it is not
Playwright. It is interesting because of **refs**: `snapshot` returns the
accessibility tree with a stable handle on every element (`@e1`, `@e2`), and
the model clicks a handle instead of inventing a CSS selector. Guessing
selectors is where agent browsing fails.

We are one step from it. `mode: aria` already returns the accessibility tree.
It does not number the nodes, and no action takes a number.

**Proposed** (built — the shape changed in two places, see the end):

- `mode: aria` emits a ref on each actionable node — `@e1`, `@e2`, …
- every action selector accepts a ref wherever it accepts a selector
- refs live in the `session`, invalidated on navigation, and a stale ref fails
  by name rather than by clicking the wrong thing

That is a change to one wrapper, no new dependency, no second implementation,
and it removes the failure mode the whole category is chasing.

## Proposed shape, if the block is unified

Bundling this with the wider `web:` consolidation (see the separate prompt):

```yaml
web:
  search: { via: brave }
  fetch:  { via: firecrawl }
  browse:
    via: browserbase        # vendor: whose machines
    engine: chrome          # chrome | firefox | safari (aliases kept)
    # protocol: cdp         # NOT YET — see above
    device: "Pixel 7"
    locale: en-AU
    timezone: Australia/Sydney
    cookies: MEDIUM_COOKIES
    cookie_domain: .medium.com
```

Deliberately absent: `library:`. If that is ever added, it should be by
someone who has first answered what an author would *see*.

## Order of work

1. ~~Unify the engine vocabulary across call and block.~~ *Done 2026-09-21:
   the call's `browser` takes chrome | firefox | safari (2026-09-20), and a
   call takes `engine` as well, refused when both name different engines.*
2. ~~Refs in `mode: aria`, refs accepted by every action.~~ *Built 2026-09-21.*
3. Revisit `protocol:` only when BiDi coverage or a vendor forces it.
4. `library:` — not planned.

## What was built (2026-09-21)

agent-browser itself was looked at again before building and left out: it is
Chrome-only (Lightpanda experimental), speaks CDP directly so it cannot use
the account's Playwright pod, has no stealth and an open report of being
challenged more often than Playwright (vercel-labs/agent-browser#575). Its
one idea worth having turned out to be in Playwright already.

- **The numbers are Playwright's own.** `ariaSnapshot({ mode: "ai" })`
  (1.59+) prints `[ref=e4]` on every element; `mode=aria` now asks for it.
- **Refs outlive navigation, instead of being invalidated by it.** Every
  call loads the page fresh, so Playwright's number would mean nothing on
  the next call. What is kept (`outputs/.browser/refs.json`, keyed by
  `session`) is what the number pointed at — role, accessible name, and
  which of the matches it was — and `"@e4"` is found again through the
  public `getByRole` (a clickable div with no role: by its text). Gone, or
  matched a different number of times than when numbered, the step fails
  and names it. No page is kept open between calls.
- **Not the `aria-ref=` selector.** It works, but it is not on Playwright's
  documented selector list; finding by role and name uses only public API.
- **`interactive=true`** cuts the snapshot to what can be acted on, one per
  line — agent-browser's `snapshot -i`.
- **Playwright is pinned** to 1.63.0 in the runner image (was `@1`), since
  the browser pods run the same image and the numbers need 1.59+.

Not covered yet: a run on Firefox or WebKit, a vendor browser (`via:`), and
a real desk page. The parser is tested against Playwright 1.63's output
shape in `foldrun-platform/tests/gallery-tools.test.ts`; a later Playwright
that prints differently fails those tests before it reaches a pod.

## 2026-09-23: what the other agent browsers have, and what was built

The question was whether `web_browse` should speak WebDriver BiDi, and
whether to build a BiDi client of our own. Neither, for now: BiDi is
experimental in Playwright (~60% of its own tests pass over it on
Chromium, ~38% on Firefox — microsoft/playwright#32577), every vendor we
connect to (`via:`) hands us CDP and nothing else, and Puppeteer's BiDi
mode drops tracing, the accessibility tree and request buffering — three
things this tool is built on. When BiDi is usable it will arrive through
Playwright and change nothing here. Watch #32577; build nothing.

The useful part of the question was the comparison. Against agent-browser
(Vercel), Playwright MCP (Microsoft), BrowserQL (Browserless), Stagehand
(Browserbase), Steel and Hyperbrowser, `web_browse` lacked a set of verbs
and, more to the point, three layers that are not verbs at all. All of it
was built the same day, in the one wrapper and the block it reads:

**Verbs** — `back`, `forward`, `reload`, `focus`, `clear`, `highlight`,
`scroll` to a selector (and `scroll` itself, which was validated but never
ran), `keyboard`, `keydown`/`keyup`, `mouse` at x,y, `wheel`, `tap`,
`swipe`, `clipboard`, `viewport`, `tab: new/close`, `dialog` mid-run,
`solve` as a step (widget, or image-to-text), `cookie` and
`localstorage`/`sessionstorage` set and delete, `offline`, `mock`/`unmock`
(and `routes=` for mocks in place before the first byte), a `wait` that
takes a load state, a URL, text, a response, a function, or "gone", and
the selector prefixes `label=`, `placeholder=`, `alt=`, `title=`, `testid=`.

**Modes** — `console`, `vitals` (Core Web Vitals, graded), `a11y`
(axe-core, pinned in the runner image; built-in checks as the fallback),
`diff` (against the last read, across runs), `feed`, plus `har=` as a
recording beside `video=` and `trace=`.

**Layers** — the ones worth the name:

| layer | shape | why it is separate |
|---|---|---|
| claims | `expect=` on the call; `expect` and `if` steps | not a read, not a write: a statement about the page that fails the call when wrong, and the thing a flow's `verify:` can lean on |
| questions | `get` and `eval` steps → results | an answer as data rather than a mode's prose |
| identity | `web_browse: identities:` in the block; `identity=` on the call | who the browser is, said once; `check` validates it like the block |
| state | `state=` → `workspace/state/browser/<name>.json` | a login that outlives the run; refuses a secret, so the vault never lands in a workspace file |

Two things from the comparison were left out on purpose. **Intent** —
Stagehand's `act("sign in")`, agent-browser's `chat` — puts a second model
inside the tool; our agent is already the model, and the failure it would
hide (a wrong guess that looked like a click) is the one the numbered
snapshot exists to remove. **Live view** — a URL a person opens to take
over the browser mid-run — is worth more than any verb above for the desks
that stall on a login, but it needs the browser pod to hold a page open
across calls, which it does not today; that is a platform change, not a
wrapper one, and it is the next thing to look at when a desk asks for it.
