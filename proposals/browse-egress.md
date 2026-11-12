# Every browser under the step's `network:` rule

*Proposal, 2026-11-02. Status: **approved** (owner, 2 Nov 2026: "do the recommendation" — all four decisions as recommended). From Linear FOL-110
(Kousha, e2e on dev). Researched against vendor docs and browser source on
2 Nov 2026 and debated with Codex over three rounds (findings verified against
the code). Each phase ships through every layer (API → dashboard → CLI → docs →
tests → Codex review → commit and push, suites on the box) before the next.*

## The problem

`network:` says which sites a step may reach, and the egress proxy holds it per
request. A step that **browses** is outside it today:

- `runner.ts:2986-2992` gives a browsing step no forward proxy (an October
  incident: in-step Chromium could not send credentials written in a proxy URL).
  Its network is marked not enforced and its run pod is never `filtered`, so
  even `curl` in that step reaches any site.
- The account's browser pod (`playwright run-server --unsafe`, pooled per
  account) reaches the whole internet (`account-pod.ts:285`) and cannot reach
  the proxy (8090 admits only run pods). Launch options come from the client.
- Lightpanda, Obscura and live Chrome run inside the step; vendor browsers
  (Browserbase, Steel, Hyperbrowser, Browserless, Bright Data, ZenRows, any CDP
  URL) browse from the vendor's network.

## What the research settled

- **A proxy setting is never enforcement by itself.** Any CDP client can give a
  new browser context its own proxy (`Target.createBrowserContext {proxyServer}`),
  in Chromium and in Lightpanda; Playwright does exactly this. A proxy holds only
  where the browser's network reaches nothing but the proxy, or where the agent
  never holds the browser connection.
- Chromium ignores credentials in `--proxy-server`; proxy auth is CDP
  `Fetch.authRequired` (what Playwright does). With an HTTP(S) proxy, DNS resolves
  at the proxy and WebSockets use it; UDP (WebRTC, QUIC) cannot.
- Request *interception* (Playwright routes, CDP Fetch) misses service workers and
  more; it is diagnostics, not a boundary. No maintained "CDP firewall" exists.
- Vendors: Browserbase (`browserSettings.proxies` type `external`, trusts our CA
  via `proxySettings.caCertificates`), Steel (`useProxy.server`, also OSS),
  Hyperbrowser (Enterprise only) and Browserless (paid) accept a customer proxy.
  Bright Data and ZenRows document none; their blocking is client-side. Whether
  any vendor sends UDP/WebRTC or falls back direct is unpublished.
- Prior art: Anthropic's sandbox-runtime removes the network namespace and leaves
  only host proxies that enforce the allowlist — the same shape as below.

## Design

**Network confinement for every browser we host; a trusted browse service for
our tool and vendor sessions; refuse what cannot be enforced.**

1. **Hosted browsers (our pod, in-step engines): confinement.** Their network
   reaches only the authenticated egress proxy and DNS — IPv4, IPv6 and UDP
   covered. A client that changes the proxy gets a connection failure, never an
   escape. One browser pod per active lease at first (no shared UID, filesystem
   or network between steps); the server owns launch flags (no `--unsafe`
   client options). In-step engines keep raw CDP inside the confined pod; each
   needs a working proxy adapter (Lightpanda `--http-proxy` +
   `--proxy-bearer-token`; Obscura `--proxy`, to verify) or is not admitted.
2. **A browse service outside the sandbox.** `browse.mjs`'s execution moves to a
   trusted service; the sandbox keeps a compatible CLI shim. The service owns
   sessions, Playwright/CDP connections, launch options, proxy auth, vendor
   credentials and lifecycle. Every action keeps its contract: click/fill/
   navigation/frames are Playwright calls; `eval` runs in the page, never in the
   service; uploads are bytes sent in, downloads/screenshots/PDF/video come back
   as scoped artifacts; live view keeps streaming frames; saved login state is
   restored into a fresh leased session.
3. **Vendors through our proxy.** A public, TLS, lease-authenticated door on the
   egress proxy; sessions created server-side with a catch-all proxy (no
   Browserbase `domainPattern` that leaves sites direct); the agent reaches a
   vendor session only through the browse service; vendor keys never in the
   sandbox. This stops the agent replacing the proxy. It does **not** prove the
   vendor's browser never goes direct, so a vendor is *enforced* only after
   qualification (below); until then it is labelled "proxy configured, not
   enforced".
4. **Three tiers, said in the trace.**
   - *Enforced — hosted:* our network boundary confines the browser.
   - *Enforced — vendor-qualified:* exclusive control + routing verified by our
     own tests, per provider and version.
   - *Not enforced:* Bright Data, ZenRows, unqualified CDP URLs. The owner opts in
     per agent; under a restricted, enforced `network:` it is refused before
     connecting. No runtime fallback.
5. **Qualification of a vendor (repeatable, in CI).** Collectors we run for
   HTTP(S), WS(S), authoritative DNS, STUN/UDP and HTTP/3; a session exercises
   navigation, eval, frames, workers, popups, downloads and new contexts, tries
   proxy changes and second sessions, and meets proxy outages, 407s, denials and
   lease expiry. Any collector hit not seen by the proxy fails it.
6. **One refusal event** from every enforcement point (admission, service,
   proxy, network): run/step/session/action, tier, destination, where, why —
   policy denial, auth failure, unsupported capability and transport failure
   kept apart. A timeout is never reported as a policy refusal.

Not claimed: control over what an *allowed* remote service fetches on its own
servers (the same is true of fetch/crawl vendors), or per-request origin checks
inside a CONNECT tunnel (the destination is checked; MITM sites see each request).

## Phases (each ships without breaking current browsing)

1. **Honest labels and admission.** Capability metadata per browser type; the
   trace says which tier a browse runs in; current behaviour stays, labelled
   *legacy, not enforced*. Refusal advice: add only the one site
   (`network: { allow: [host] }`), never "or set network: open".
2. **The browse service** behind a switch; the existing action suite passes
   through it; gallery copies updated without overwriting customisations.
3. **Hosted enforcement**, per engine: drop the runner exemption; browser pods
   proxy-only with per-lease pods and server-owned launch options; filtered run
   pods reach their browser; egress CA trusted by the browser for secret-bound
   sites; MITM WebSocket upgrades; tunnels closed when a lease ends.
4. **Vendors:** the public proxy door, then each provider qualified on its own.

## Decided (owner, 2 Nov 2026)

1. The browse-service shape: execution leaves the sandbox. Yes.
2. One browser pod per active lease at first. Yes.
3. A public, authenticated door on the egress proxy for vendor browsers. Yes.
4. Bright Data / ZenRows / raw CDP: refused under a restricted, enforced
   `network:`; otherwise opt-in per agent as *not enforced*. Yes.

No new container image: the browse service and per-lease browser pods run on
the full runner image, as the browser pod does today.

## Status

| Phase | Status | Shipped in |
|---|---|---|
| 1. Labels and admission | deployed on dev (v2026.11.02.2, 2 Nov); not yet clicked through — dev moved to AWS and has no account with an agent yet | core d684047, web 6f7f5fe, cli b215e07, docs 0ca9f0e |
| 2. Browse service | built 5 Nov 2026 behind `FOLDRUN_BROWSE_SERVICE=1` (k8s only); **on for dev since v2026.11.08.2** (infra 15b0ede, 8 Nov: a step's browse pod was made and answered on the cluster — a page through it not yet checked there), off elsewhere; for steps **not** held to their list (a held step keeps its browser in its walled pod, decision 2 as amended); Chromium and Chrome; vendors, live, Lightpanda/Obscura, Firefox/WebKit and extensions stay in the step — see *Phase 2 as built* | on main |
| 3. Hosted enforcement | live on dev since v2026.11.05.3 (5 Nov 2026), `FOLDRUN_BROWSE_ENFORCE=1` (k8s only), in the browser-in-the-step shape below (owner accepted, 5 Nov); a held pod has no DNS since v2026.11.05.4; web search through the proxy's door (FOL-128, below) | core eead367, platform 4cc7432, infra 8699c66 + d9f7c49 |
| 4. Vendors | planned | |

## Phase 3 as built (5 Nov 2026) — an amendment for the owner to confirm

Debated with Codex over two design rounds and a code review of each repo.
**The browser runs inside the step's own run pod, not in a separate
per-lease browser pod.** On the k8s tier a
step whose list is restricted and enforced already runs in a `filtered` pod
(foldrun-infra `run-network-policy.yaml`): the egress proxy and DNS, nothing
else. That pod is the lease's own — one per step attempt, no UID, file or
network shared with another step — so a browser launched in it is confined
by the same wall, which is what decision 2 asked of a per-lease pod. A
separate pod would add process and filesystem separation from the agent and
trusted ownership of sessions — worth having for phase 2's browse service —
but nothing to the network boundary, at the cost of a new object lifecycle
and billing path. It remains the next step if wanted.

What ships:

- **Runner** (core `browse-egress.ts` `browseVerdict`, `runner.ts`): with
  `Platform.confinesBrowsing` true (k8s + `FOLDRUN_BROWSE_ENFORCE=1`), a
  restricted list and `lease.enforce`, a browsing step gets the forward proxy
  like any other (the exemption is dropped for it), so its pod is filtered;
  `FOLDRUN_BROWSER_CONFINED=1` tells the web tool; the trace says *enforced —
  hosted*. Any vendor under that held list is refused before a sandbox (every
  vendor: none is qualified yet), with the per-agent opt-out of decision 4
  (`network: open` on that agent) named — the one place the advice mentions
  open. Off the switch, an open list or a report-only one: exactly as before.
- **Platform**: no account browser pod for a held step, said in the trace.
  The account's search pod is still started for it, and reached through the
  egress proxy's search door (see *Web search under a held list*, below —
  this line said "nor search pod" until 12 Nov 2026, which the code never
  did after FOL-128); a resumed sandbox's own label is read and the trace says when
  its wall differs from what the driver would build now.
- **The web tool's browse program**: the forward door as launch options
  (`proxy: {server, username, password}`, loopback bypassed) — Playwright
  answers the 407; `proxy=`, a vendor, `live:`, Lightpanda and Obscura are
  refused (no verified proxy adapter); WebRTC non-proxied UDP off; Chromium
  trusts the egress CA by its key (`--ignore-certificate-errors-spki-list`),
  for which the proxy now serves the CA in the intercepted chain; Firefox and
  WebKit are told they will not; a bound secret's `${NAME}` is refused where
  the browser needs the value (`auth=`, `cookies=`, `storage=`).
- **Egress proxy**: CONNECT tunnels and intercepted connections are tracked
  by lease and closed within ~30 s of the lease ending (each proxy process
  sweeps its own; a lease store that cannot answer closes nothing), and on
  stop or a drain's deadline.
- **Infra**: `dev/ci/isolation-probe.sh` starts a second, filtered probe pod
  on every dev deploy; it must fail to reach a public address, a name, IPv6
  and an outside resolver over UDP, with unwalled controls beside them.

Owed (not in phase 3): MITM WebSocket upgrades (a WSS to a host a secret is
granted to fails), a DNS-restricting resolver (DNS lookups are not held),
Lightpanda/Obscura proxy adapters, live sessions under a held list, Firefox
and WebKit trust of the egress CA, and per-lease browser pods (above).

## FOL-128 as built (5 Nov 2026) — the first two of those

Debated with Codex over two rounds before any code.

**DNS: none at all for a walled pod, not a filtered resolver.** A Cilium
DNS-aware policy (answer only the names the list allows) was the other
option. It was dropped: Cilium-only, a policy object per step to write and
collect, a wildcard site still lets a lookup under it reach that domain's
nameserver — and the pod needs no answers, because every program names its
site to the proxy (`CONNECT host:port`) and the proxy resolves only what the
list allows, after checking it. So with `FOLDRUN_RUN_DNS_WALL=1` a filtered
pod is labelled `foldrun.io/dns: none`; `foldrun-run-dns`, the run DNS rule
now in a policy of its own, does not select it (NetworkPolicies add up, so
`foldrun-run-egress` must never grant DNS again — a platform test reads the
manifest for that). The pod gets `dnsPolicy: None` with a nameserver that is
not there (a lookup fails at once, no packet leaves) and the egress
address in `/etc/hosts`, which the worker looks up when it makes the pod; a
step whose proxy address cannot be found does not start. The switch rides
in foldrun-infra's base manifests with the policy, so the two cannot skew;
a pod without the label keeps DNS, so the platform and the manifests roll
out in either order. Checked: the pinned Claude CLI, behind a proxy, sends a
name it cannot resolve to the proxy as a CONNECT, with or without
`CLAUDE_CODE_PROXY_RESOLVES_HOSTS` — so that variable is not set.

What breaks in a walled pod: what asks DNS itself — `dig`, `ping` by name,
an MX check, a client that resolves before it connects. Its way out is a
DNS-over-HTTPS site on its list, or `network: open`. What stays: the proxy
resolves names an allowed wildcard covers, and a tunnel to an allowed host
may use any port — both bounded by the list.

`dev/ci/isolation-probe.sh` builds its filtered pod the platform's way and
asks a never-asked name over UDP and TCP of the cluster's resolver Service,
each CoreDNS pod, the node and the NodeLocal DNSCache default address: no
DNS answer may come back. The ordinary pod's answers from the Service and a
CoreDNS pod are the control. The egress control is reached by name, so it
proves the `/etc/hosts` entry too.

**WebSocket to a bound site.** The intercepted connection now passes an
HTTP/1.1 `Upgrade: websocket`: the opening request is filled by the same
code as any request (`prepareRequest`: URL, headers, Basic auth, no secret
in the authority; the same client certificate and DPoP rules), sent over
TLS to a public address, and on the site's 101 the frames are piped both
ways, unread, until either side closes or the lease ends. Any other answer
goes back as it is. Refused: another upgrade token (501), the platform's
model keys (metered per request, which a WebSocket has none of), and a test
run's WebSocket to a site test mode does not hold read-safe.

## Web search under a held list, as built (5 Nov 2026, FOL-128)

Owner, 5 Nov 2026: search should work for a held step. Debated with Codex
over two design rounds before the code, and a code review after.

**What was broken.** Not only browsing steps: every walled step (`filtered`
pod) that searched our engine was handed the search pod's address, which
its wall drops — three retries, then "unreachable". A named provider
(`web: {search: brave}`) worked: its host is declared, its key filled at
the proxy.

**Semantics.** The account's engine is a platform service reached through
the egress proxy, never a site on the list. Search is a declared way out for
the *words* of a query — nothing can stop words carrying what the step
knows (an engine sees them; a site owner can see the queries its pages
appeared for). The door bounds where they go and records that they went; it
does not make a query safe to fill with secrets. Results are data, off-list
snippets included; opening a result is a fetch, held to the list.

What ships:

- **Core** (`search-egress.ts` `searchDoorWanted`, `runner.ts`): after the
  lease, from the runner's own resolved `web:` config and the lease's
  effective enforce (the install's switch too), a walled step that searches
  our engine gets `grant.search` (with `max` from `limits:`), sealed in the
  lease, and the door's address for the driver. At `none` or `defaults:
  false` the action must be written in `web: {actions: [...]}`; a bare
  `tools: [web]` is not given it, and the trace says why. Off a held list:
  nothing changes.
- **Platform**: the proxy's door `/s/<lease>/search|config`
  (`search-door.ts`) answers only a grant with `search`; it rebuilds the
  upstream query itself — a fixed engine list (`yandex, naver, brave,
  wikipedia`; `arxiv, pubmed`; `github, stackoverflow`), always sent as an
  explicit list the instance has loaded (SearXNG given none it knows falls
  back to its defaults), and an answer naming any other engine is refused;
  bangs, `<n` timeouts, control and format characters, URLs and `${NAME}`
  placeholders in the query refused in fixed words; no plugin, DOI resolver
  or timeout from the caller; JSON only, no redirect, the answer cut to what
  the tool reads; a per-lease count shared across replicas in Redis (a
  store that cannot count sends nothing), four at a time per replica; a
  trace line written before each search is sent (engines and length, never
  the words, which would sit unredacted in the lease store). The door is
  closed when the install's search image is not the digest its engines
  were read in. The k8s driver points a walled step's tool at the door
  (`FOLDRUN_SEARCH_HELD=1`: the tool keeps the door's path and opens held
  results with an outside-content line); the search pod's own policy now
  admits the proxy (worker or egress pods, namespace and pod in one peer,
  TCP 8080), and an older pool's policies are applied again once per worker.
- **Infra**: the worker's and egress pods' policies may reach
  `app=foldrun-search` in `foldrun-runs` on 8080; the filtered run pod's
  wall is unchanged. `dev/ci/isolation-probe.sh` stands up a stand-in search
  pod with the Service and policies the running worker's code writes: the
  filtered pod must not reach it (pod address and Service), the proxy must.
- **Dashboard / CLI**: the Network card and `foldrun agent network` say how
  a held step searches, or that it is not offered.

Not claimed: that a query cannot exfiltrate (it can, by its words, to the
engines and to whatever they report to site owners); that every engine in
the list was qualified against the pinned image by running it (they were
read in upstream source; the digest pin forces a re-read on a new image);
an in-flight cap across replicas (the count is shared, the four-at-once is
per replica); per-action `limits:` at the door (it holds their sum); full
query words in the proxy's trace (the tool call carries them).

Still owed: the owner's word on running the browser in the step's own pod
(above), Kousha's re-test (now with search), the door verified on dev, and
phases 2 (browse service) and 4 (vendor door).

## Phase 2 as built (5 Nov 2026)

Debated with Codex over two rounds before and during the code. The owner
had by then accepted the browser-in-the-step shape for a **held** step
(phase 3), so the service is built for the other steps: an open list, a
report-only one, an install that does not confine browsing — today's
browsers that reach the world straight from the sandbox.

**A pod per step lease, not the account's pool.** The service holds the
step's lease (its browser's proxy password) and the secrets a call names; a
pool would put two steps under one user and process tree, so a page that
broke out of one step's Chromium could read the other's. `foldrun-browse-<16
hex of the lease's SHA-256>`, made beside the run pod (`ownerReference` to
it, deleted in the step's `finally`, billed as `browse`; an orphan — a run
pod gone or finished — is swept on the scheduler's tick), on the runner
image (no new image), gVisor like a run pod, no service-account token,
read-only root. Its program is a ConfigMap named by its content
(`browse-service.mjs` and the **gallery's** `browse.mjs` — never an
account's copy), server-side applied; old ones a day unused are collected.

**Reached only through the egress proxy:** `/browse/<lease>`. The proxy
checks the lease, refuses a test run, a host job and a held lease (its own
check; a held step is never given the door), and sends the call to the
lease's own pod, by name, from the lease — nothing in the request picks it.
The pod answers only a call whose lease hashes to its own
`FOLDRUN_BROWSE_LEASE_ID` (the token is never in a cluster object). Its
network policy, applied with every pod because the run namespace has no
default deny: in, the proxy (or the worker, where the proxy runs there) on
3100; out, the proxy on 8090 and DNS. foldrun-infra's proxy and worker
policies carry the matching rules. No separate key: the lease is the
per-step credential, dies with the step, and the network says who knocks.

**One call:** the sandbox's `web` tool (`run.mjs` → `browse-remote.mjs`, a
new file of the gallery tool; copies nobody edited are upgraded as every
gallery change is) sends the arguments, the browse settings and the
variables the call names (a secret's NAME in `cookies=`, `auth=`, headers,
a login), and the workspace files it reads — the aria numbers, sessions as
storage state, the named saved login, the diff baselines or crawl frontier,
any upload, paste, mock or init file the call names — read without following
a symlink, 64 MB at most. The service runs the platform's `browse.mjs` in a
fresh scratch tree with an environment it builds from a positive list (the
browse settings, secret-shaped names that steer no program; never
`NODE_OPTIONS`, `LD_*`, proxy variables or `PLAYWRIGHT_*`), plus the proxy
under the lease, the live-view door, `FOLDRUN_BROWSER_CONFINED=1` (the
browser takes the proxy as launch options — phase 3's code) and
`FOLDRUN_BROWSE_SERVICE_SIDE=1` (a session is storage state; loopback is not
bypassed). The answer streams back; files the call wrote come back and are
written by rename, never through a symlink. A copy of `browse.mjs` that is
not the platform's (by SHA-256) is answered 409 and runs in the step.

**Never twice.** A call that never connected (refused, no name) runs in the
step; a call the service refused before starting (403, 409, 429, 503) too.
Once it may have started — the stream began, or the connection failed in
any other way — it is not run again anywhere; it fails saying it may have
acted. A call whose caller left while it waited its turn never starts, and
a call whose caller leaves is killed with its process group.

**Not through the service (in the step, as before):** `live:`, Firefox,
WebKit, Lightpanda, Obscura, `extensions:`, `proxy=`, identities with a
proxy or another engine, a page on loopback or a private address, vendors
(no vendor runs through it yet — that is phase 4's door). Verified: the
unit tests (door, pod objects, service, shim, lifecycle with a fake
kubectl) and, with real Chromium, the action suite — text, markdown,
screenshot, fill/click/get, upload, download, PDF, a session across calls,
a saved login, aria numbers used by the next call — through shim → door →
service → Chromium → forward door, the proxy's own record naming the pages.
Not yet on a cluster: turning it on is `FOLDRUN_BROWSE_SERVICE=1` on the
worker and the egress proxy together (foldrun-infra), then a browsing desk.

Owed: the service under a held list (it would make a held step's browser a
separate pod, phase 3's "next step if wanted"), vendors through it with the
public proxy door (phase 4), live sessions in it, Firefox and WebKit, and
Chromium's own sandbox inside the pod (off, as in every runner today).

## Firefox and WebKit trust of the egress CA (FOL-128, 8 Nov 2026)

Tried in the runner image itself (v2026.11.08.2, Playwright 1.63, as the
agent user), against an HTTPS server whose leaf a test CA signed and which
sends the CA in its chain, as the proxy does:

| Engine | Trusts the CA through | Does not |
|---|---|---|
| Chromium | `--ignore-certificate-errors-spki-list` (today's code; needs the CA in the served chain, which the proxy sends) | — |
| Firefox | its profile's NSS database, filled with `certutil` (libnss3-tools) | the system store, `SSL_CERT_FILE`, `security.enterprise_roots.enabled`, a `distribution/policies.json` |
| WebKit | the system store (`update-ca-certificates`, root) | `SSL_CERT_FILE`, `SSL_CERT_DIR`, a p11-kit user anchor, GnuTLS environment |

**Firefox, as built.** The full image carries libnss3-tools. A held step
asking for Firefox, outside the browse service, browses in a persistent
context whose profile trusts the CA (`-t C,,`, one nickname): the session's
own profile, or one made for the call and removed after. A certificate that
is not a CA, or no certutil, leaves the old line: the engine does not trust
the proxy's certificate. Tested with real Firefox and the platform's real
egress CA (`foldrun-platform/tests/browse-firefox-ca.test.ts`, in CI).

**WebKit, decided (Codex debate, 8 Nov 2026), and built the same day** (foldrun-platform `src/egress-ca-trust.ts`). Root must not
install a CA read from the job folder: it is the agent's (owned by it, kept
by `--no-overwrite-dir`), so it is agent-writable input to root even though
nothing runs as the agent before root's start today. Instead: the public CA
as a platform-owned immutable ConfigMap; an init container from the same
image validates it (one certificate, a CA) and builds the whole system store
into an emptyDir, mounted at `/etc/ssl/certs` in the run pod, owned by root
(the agent cannot write it; root's apt can still regenerate it for a
`runtime: system:` package — a read-only mount broke that, Codex review);
root's start still reads nothing of the step's. Only for steps that get the
CA today. The ConfigMap is named by the CA's key and subject, not its bytes
(each process signs its copy again), and created, never applied over. The
browse pod gets it when it serves Firefox and WebKit. The CA has no name constraints, so the trust
is as wide as the proxy's key, which never leaves the proxy.
