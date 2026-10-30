# Environment reference

Everything the platform reads from its environment — and, where marked,
what the CLI on your machine reads too. Most of these are ours to set;
they are documented because the behaviour they switch is yours to know.
Unset means the default in the right-hand column; a blank default means
the feature is off.

## Operator settings

Since 30 Oct 2026 the variables below are **operator settings**: values the
platform reads from its own database table (`platform_settings`) first,
and from the variable only when no row says. Precedence, per key: the row,
else the variable, else the default in the third column. With no rows an
install behaves exactly as its environment says, so a self-hosted install
can keep setting these as variables — nothing changes for it.

On foldrun's hosted platform they are changed in the operator console
(admin.foldrun.io → Settings), never by a deploy: every pod picks a change
up within ten seconds, each change is audited by the operator who made it,
and a run is charged at the prices it started under (its run-start price
snapshot), never at a price changed while it ran. The variables stay read
as the fallback for at least one release after a deployment stops setting
them, so a rollback still has its values.

What is still environment — addresses, credentials, identity, pod and node
sizes, and the security switches (`FOLDRUN_MULTI_TENANT`,
`FOLDRUN_NETWORK_ENFORCE`, the vault and egress switches) — is never a
setting and never editable from a web page.

| setting | variable (fallback) | default | |
|---|---|---|---|
| `signup.open` | `FOLDRUN_OPEN_SIGNUP` | `false` | Strangers may create accounts. Off: invite-only once the first account exists. Owners only. Asks for a reason when turned on. |
| `plan.concurrency` | `FOLDRUN_PLAN_CONCURRENCY` | unset | Runs one account drives at once when its plan says nothing. 0: no cap. |
| `plan.workspaces` | `FOLDRUN_PLAN_WORKSPACES` | unset | Workspaces an account may create when its plan says nothing. 0: no cap. |
| `account.concurrency` | `FOLDRUN_ACCOUNT_CONCURRENCY` | unset | Runs one account may have in flight across every worker, unless its plan gives more. 0: no cap. |
| `account.pods` | `FOLDRUN_ACCOUNT_PODS` | unset | Sandboxes one account may have running at once; a fan-out takes turns. 0: no cap. |
| `account.vcpu` | `FOLDRUN_ACCOUNT_VCPU` | unset | Cores one account's running steps may hold together (no plan). 0: no cap. |
| `account.memory_gib` | `FOLDRUN_ACCOUNT_MEMORY_GIB` | unset | GiB one account's running steps may hold together (no plan). 0: no cap. |
| `account.disk_gib` | `FOLDRUN_ACCOUNT_DISK_GIB` | unset | GiB of disk one account's running steps may be allowed together (no plan). 0: no cap. |
| `step.max_vcpu` | `FOLDRUN_STEP_MAX_VCPU` | unset | A step asking for more fails at once (no plan). 0: no cap beyond the pool. |
| `step.max_memory_gib` | `FOLDRUN_STEP_MAX_MEMORY_GIB` | unset | A step asking for more fails at once (no plan). 0: no cap beyond the pool. |
| `step.max_disk_gib` | `FOLDRUN_STEP_MAX_DISK_GIB` | unset | A step asking for more fails at once (no plan). 0: no cap beyond the pool. |
| `room.run_memory_gib` | `FOLDRUN_RUN_MEMORY_GIB` | unset | Memory the run namespace may reserve; a step waits for room past it. 0: no limit. Never on an autoscaled cluster. Owners only. |
| `room.run_disk_gib` | `FOLDRUN_RUN_DISK_GIB` | unset | Disk the run namespace's pods may be allowed together; a step waits past it. 0: no limit. Never on an autoscaled cluster. Owners only. |
| `pods.search_max` | `FOLDRUN_SEARCH_MAX_PODS` | `3` | The most search pods one account's pool grows to. |
| `pods.browser_max` | `FOLDRUN_BROWSER_MAX_PODS` | `4` | The most browser pods one account's pool grows to. |
| `assistant.account_cap` | `FOLDRUN_ASSISTANT_ACCOUNT_CAP` | `3` | Assistant replies of one account running at once across every assistant pod. |
| `grade.account_limit` | `FOLDRUN_GRADE_ACCOUNT_LIMIT` | `4` | Runs a grader eval grades for one account in one pass. |
| `runner.cpus` | `FOLDRUN_RUNNER_CPUS` | `2` | A default-size step's cores: its limit and its billing weight. Owners only. |
| `runner.memory` | `FOLDRUN_RUNNER_MEMORY` | `2g` | A default-size step's memory, e.g. 6Gi: a hard ceiling and a billing weight. Owners only. |
| `runner.cpus_small` | `FOLDRUN_RUNNER_CPUS_SMALL` | `1` | size: small — cores. Owners only. |
| `runner.memory_small` | `FOLDRUN_RUNNER_MEMORY_SMALL` | `1Gi` | size: small — memory, e.g. 1Gi. Owners only. |
| `runner.cpus_heavy` | `FOLDRUN_RUNNER_CPUS_HEAVY` | `4` | size: heavy — cores. Owners only. |
| `runner.memory_heavy` | `FOLDRUN_RUNNER_MEMORY_HEAVY` | `8Gi` | size: heavy — memory, e.g. 8Gi. Owners only. |
| `runs.retention_days` | `FOLDRUN_RETENTION_DAYS` | unset | Finished runs older than this are pruned by the hourly pass. 0: kept for ever. Owners only. Asks for a reason when lowered. |
| `webhooks.disable_days` | `FOLDRUN_WEBHOOK_DISABLE_DAYS` | `3` | A notify: webhook failing every delivery this long is switched off. |
| `mail.from` | `FOLDRUN_EMAIL_FROM` | `foldrun <hello@foldrun.io>` | The From of the platform's own mail. Its domain must be verified at the mail provider, or every send is refused. Owners only. Asks for a reason. |
| `mail.invites_per_day` | `FOLDRUN_PLATFORM_INVITES_PER_DAY` | `25` | Recipients one account may invite per day on the platform's mail key. |
| `mail.per_day` | `FOLDRUN_PLATFORM_MAIL_PER_DAY` | `200` | Recipients of notify:, approvals and the like, per account per day, on the platform's mail key. |
| `schedule.spread_sec` | `FOLDRUN_SCHEDULE_SPREAD_SEC` | `0` | Scheduled runs start up to this many seconds after their minute, the same offset per flow every day. 0: on the minute. |
| `billing.max_run_exposure` | `FOLDRUN_MAX_RUN_EXPOSURE` | unset | What admission holds of the balance for each unsettled run. 0: the flow's own history decides. Owners only. |

The hosted build adds its own (prices, billing, the Stripe catalogue —
`FOLDRUN_MARGIN`, `FOLDRUN_BILLING`, `STRIPE_PRICE_*` and the rest); an
install built from the public repositories has none of them.

`FOLDRUN_PLATFORM_KEY_ACCOUNTS` is not a setting but, on the hosted
platform, a per-account lever: an account may use the platform's own model
credential only when the operator granted it (fail-closed). The variable's
names count for one release more, and unset or `*` means nobody there. A
self-hosted install reads the variable as before.

## Core

| variable | |
|---|---|
| `FOLDRUN_SECRET_KEY` | the root key that wraps every account's keys. Generate once, keep out of every backup that holds the data |
| `FOLDRUN_VAULT_WRITE_BOUND` | `1`: secrets are sealed for their place — the account, the scope (account or workspace), the name, its kind and the sites it is bound to — so a stored value moved to another name, scope or account, or with its sites rewritten, no longer opens (it reads as not set). Account keys are wrapped bound to their account, and a two-step secret to its person (re-sealed at that person's next sign-in). At boot, every older record is sealed the same way, file by file. Set it once every pod runs a release that reads bound records (all since 29 Oct 2026) |
| `FOLDRUN_VAULT_REQUIRE_BOUND` | `1`: an unbound (older) secret record reads as not set. Set after the boot log shows nothing left unbound |
| `FOLDRUN_INSTALL_KEY_ABSENT` | `1` on a process that must never hold the install key (an egress pod): asking for it throws instead of creating `.secret-key` on the data volume |
| `FOLDRUN_DATA` / `FOLDRUN_DATA_DIR` | the data directory — every workspace, run and user |
| `FOLDRUN_PUBLIC_URL` | the origin the outside world reaches this install on; needed for approve links and shares |
| `FOLDRUN_TRUST_PROXY` | `1` behind a proxy, tunnel or load balancer — the rate limiter reads the forwarded address (`X-Forwarded-For`). `cloudflare` behind Cloudflare — it reads `CF-Connecting-IP`, which Cloudflare writes over whatever the client sent, and never `X-Forwarded-For` |
| `FOLDRUN_EDGE_SECRET` | required by `FOLDRUN_TRUST_PROXY=cloudflare`: `CF-Connecting-IP` counts only when the request carries `X-Foldrun-Edge` equal to this, which a request header rule in your Cloudflare zone sets at the edge. A Cloudflare address alone proves nothing (anyone's Worker can call your origin and set the header). Unset or empty: no address, and per-IP limits limit no one. The mode reads only the address; links come from `FOLDRUN_PUBLIC_URL`, so set it |
| `FOLDRUN_OPEN_SIGNUP` | `1` lets strangers create accounts. Last switch on. Since 30 Oct 2026 an [operator setting](#operator-settings), `signup.open`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_SETUP_TOKEN` | when set, the install's first account (its owner) can be created only with it: `/signup?setup=<token>`. The self-hosting installer writes one to `.env` and prints that link, so another user of the same machine cannot sign up first. Unset, the first signup is free; once any account exists it does nothing |
| `FOLDRUN_MULTI_TENANT` | `1` on any install that will serve more than one account — refuses to run without step isolation |
| `FOLDRUN_EDITION` | `hosted` or `self-hosted`, said outright. An install built from the public repositories is always `self-hosted`: it has no billing pages or operator console to turn on |
| `FOLDRUN_VERSION` | the version `/api/healthz` and the dashboard report (default `dev`); set by the image build |
| `FOLDRUN_ACCOUNT` | the account folder, for a program that embeds foldrun and knows where its account is. Beats the usual search upward from the working directory |

## Models

| variable | |
|---|---|
| `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` | the platform's default model credential |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `…_SONNET_MODEL`, `…_OPUS_MODEL` | which model each tier (`fast`, `default`, `max`) resolves to |
| `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` | point the default credential at a compatible endpoint |
| `FOLDRUN_FALLBACK_BASE_URL`, `FOLDRUN_FALLBACK_TOKEN`, `FOLDRUN_FALLBACK_{HAIKU,SONNET,OPUS}_MODEL` | a second endpoint a step retries on when the primary refuses |

## Isolation and the runner

| variable | |
|---|---|
| `FOLDRUN_RUN_ISOLATION` | `container` (one box) or `k8s` (a cluster). Unset runs steps in-process — one account only |
| `FOLDRUN_RUNNER_RUNTIME` | the `RuntimeClass` for run pods, e.g. `gvisor` |
| `FOLDRUN_RUNNER_IMAGE` | the image a step executes in — the full one, browsers included. Both runner images are built by core from one Dockerfile (`foldrun-core/src/run-container.ts`) on Debian 13 (`node:22-trixie-slim`, pinned by digest, so a tag always names the same bytes), with Python 3.13, uv, git and the Playwright client |
| `FOLDRUN_RUNNER_SLIM_IMAGE` | the same image without browsers (a quarter of the size), for a step that plainly cannot launch one. It carries fonts for text drawn without a browser (resvg, sharp): DejaVu, Symbola for emoji, WenQuanYi Micro Hei for Chinese, Japanese and Korean, Lohit for Devanagari and Loma for Thai. A step gets the full image if it grants browsing, has an MCP server started by `command:`, has a script tool whose source names `playwright`, `puppeteer`, `chromium`, `chrome`, `selenium` or `webdriver` (or whose source cannot be read), has a `runtime:` that installs one, or grants Bash with a prompt that names one; the step's log says which. A step whose **only** reason is that it browses runs slim when the account's browser pod is up for it, and every browse call renders in the pod — not an outward step, a test run, a step naming a browser vendor, or one whose `web.browse` block asks for `live`, `extensions`, `lightpanda` or `obscura` ([slim steps and a lost pod](tools#slim-steps-and-a-lost-pod)). The run record says which image each step ran on (`image`). Unset or empty: every step runs `FOLDRUN_RUNNER_IMAGE` |
| `FOLDRUN_SLIM_BROWSING` | `0` keeps every browsing step on the full image, as before 1 Oct 2026, even where the account's browser pod could serve it. Unset: browsing steps run slim where they can |
| `FOLDRUN_RUNNER_ENGINES` | the engines the runner image was built with, set by every deploy from the image's `/opt/browser/engines.json` (`foldrun-infra/dev/ci/runner-engines.sh`): a comma list, each name with `=<version>` where the manifest has a dotted one — `chromium=153.0.8010.12,chrome=154.0.8037.58,firefox,webkit,lightpanda=0.4.1,obscura=0.2.3`. `/api/version` reports the names as `browsers` and the versions as `browser_versions`; the deploy warns about an agent's pinned `user_agent:` whose Chrome major is not its engine's (`chrome`'s, or `chromium`'s for engine chromium). The published web image carries it too. Unset: unknown, and nothing is compared |
| `FOLDRUN_RUNNER_NETWORK` | the network run containers join |
| `FOLDRUN_CONCURRENCY` | runs one worker pod drives at once — hardware, in practice. With several worker pods (a cluster) it is per pod; the fleet's capacity is the sum |
| `FOLDRUN_RUN_MEMORY_GIB` | memory the run namespace's pods may reserve, in GiB — the node's memory less the platform's. A step whose sandbox would not fit waits to start (not billed) instead of its pod sitting Pending until the step fails. Counts every live pod in that namespace: run sandboxes, the accounts' browser and search pods, runtime builds. Unset is no limit. **Never set it on a cluster with a node autoscaler** (Karpenter): the gate would hold steps before their pods exist, and the autoscaler adds a node only for a pod it cannot place — production leaves it unset, and foldrun-infra's `dev/ci/prod-node-budgets.sh` refuses it there. Since 30 Oct 2026 an [operator setting](#operator-settings), `room.run_memory_gib`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_NODE_MAX_MEMORY_GIB` | the memory of the largest node a step's pod can land on, in GiB: a step's memory is reserved whole, so one asking for more fails at once with the reason instead of waiting for a node that will never exist. Set it to the biggest node's allocatable memory (on an autoscaling cluster, the biggest instance it can make). Cores are not checked: a pod requests less CPU than its limit. Unset: no check |
| `FOLDRUN_RUN_DISK_GIB` | disk the run namespace's pods may be allowed together, in GiB — counted by each pod's ephemeral-storage limit (else its request). A step that would pass it waits to start; one that alone is bigger fails at once. Set it at or below the node's allocatable ephemeral storage. Kubernetes still places pods by their requests, so a pod can still find no node with room: it then waits, uncharged, saying so (a pod no node could ever take still fails). Unset is no limit. Like `FOLDRUN_RUN_MEMORY_GIB`, never on an autoscaled cluster. Since 30 Oct 2026 an [operator setting](#operator-settings), `room.run_disk_gib`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_ACCOUNT_PODS` | sandboxes one account may have running at once, so one fan-out takes turns instead of the node. Unset is no limit. Since 30 Oct 2026 an [operator setting](#operator-settings), `account.pods`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_ACCOUNT_VCPU`, `FOLDRUN_ACCOUNT_MEMORY_GIB`, `FOLDRUN_ACCOUNT_DISK_GIB` | the cores, GiB and GiB of disk (ephemeral-storage limits) one account's running steps may hold together, for an account with no plan that sets them — counted by each run pod's CPU and memory limits. A step that would pass it waits to start; one bigger than it fails. An account's own `compute:` may lower it, never raise it. Enforced by the room gate under k8s isolation; the Docker executor (`FOLDRUN_RUN_ISOLATION=container`, the self-hosted Compose install) caps each step at its class but has no pool. Unset is no cap. Since 30 Oct 2026 [operator settings](#operator-settings), `account.vcpu`, `account.memory_gib`, `account.disk_gib`: on foldrun's hosted platform they are edited in the operator console; these variables are their fallback, and how a self-hosted install sets them. |
| `FOLDRUN_STEP_MAX_VCPU`, `FOLDRUN_STEP_MAX_MEMORY_GIB`, `FOLDRUN_STEP_MAX_DISK_GIB` | the most one step may hold, for an account with no plan that sets it; a step asking for more (its class or its `resources:`) fails at once, naming the figure. Under k8s isolation, as the pool. Unset is no cap beyond the pool. Since 30 Oct 2026 [operator settings](#operator-settings), `step.max_vcpu`, `step.max_memory_gib`, `step.max_disk_gib`: on foldrun's hosted platform they are edited in the operator console; these variables are their fallback, and how a self-hosted install sets them. |
| `FOLDRUN_ROOM_PARK_AFTER_SEC` | how long a group waits for room in its worker before its run goes back to the queue to wait there, freeing the worker — only once nothing else of the group is running. Default 60. A wait for room has no time limit ([waiting for room](budgets-and-billing#waiting-for-room)) |
| `FOLDRUN_ROOM_RECHECK_SEC` | how often a run waiting in the queue for room is claimed to look again. Default 20 |
| `FOLDRUN_ROOM_ALERT_MIN` | how long a step may wait for room before the workspace's `notify:` hears of it, once per run, as event `room`. Default 60 |
| `FOLDRUN_ROOM_WAIT_SEC` | no longer read (27 Oct 2026): a step waiting for room used to fail after this many seconds; it now waits as long as it takes |
| `FOLDRUN_SCHEDULE_SPREAD_SEC` | scheduled runs start up to this many seconds after their minute — the same offset for the same flow every day, so fifty 8:00 desks arrive over the minute rather than in one instant. Unset is 0. Since 30 Oct 2026 an [operator setting](#operator-settings), `schedule.spread_sec`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_ACCOUNT_CONCURRENCY` | one account's share of the whole fleet, for an account with no `concurrency:` of its own — honoured by the queue claim itself, so it holds across every worker pod. Unset is no cap: right for one company's box, wrong for a platform, where one fan-out flow would otherwise hold every slot. An account's own `concurrency:` (Settings → Governance) may lower its share, never raise it past this; the plan the operator gives that account is what raises one. Since 30 Oct 2026 an [operator setting](#operator-settings), `account.concurrency`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_SCHEDULE_RESCAN_MS` | how often the scheduler re-reads every workspace's flows from disk (default 5 minutes). Between rescans it reads memory, patched the instant a workspace is written, deployed, pushed or deleted through the platform; the rescan only catches a file that arrived some other way |
| `FOLDRUN_RUNNER_CPUS`, `FOLDRUN_RUNNER_MEMORY` | the cores and memory for a step of default `size:` (2, 2Gi): the rate its seconds are billed at and its hard limits. Docker's `--cpus` is lowered to what the engine has, so a class bigger than the machine still starts. Since 30 Oct 2026 [operator settings](#operator-settings), `runner.cpus`, `runner.memory`: on foldrun's hosted platform they are edited in the operator console; these variables are their fallback, and how a self-hosted install sets them. |
| `FOLDRUN_RUNNER_CPUS_SMALL`, `…_MEMORY_SMALL`, `…_CPUS_HEAVY`, `…_MEMORY_HEAVY` | for `size: small` (1, 1Gi) and `size: heavy` (4, 8Gi). Since 30 Oct 2026 [operator settings](#operator-settings), `runner.cpus_small`, `runner.memory_small`, `runner.cpus_heavy`, `runner.memory_heavy`: on foldrun's hosted platform they are edited in the operator console; these variables are their fallback, and how a self-hosted install sets them. |
| `FOLDRUN_RUNNER_CPU_REQUEST`, `…_CPU_REQUEST_SMALL`, `…_CPU_REQUEST_HEAVY` | the CPU a run pod reserves on the node (k8s `requests.cpu`): 250m, 100m, 500m by default. This decides how pods pack onto a node and each pod's share when every core is busy. It is never above the class's cores; a request tuned higher is lowered to the limit |
| `FOLDRUN_RUNNER_DISK`, `…_DISK_SMALL`, `…_DISK_HEAVY` | node disk a step may write (k8s `ephemeral-storage` limit): 8Gi, 2Gi, 20Gi by default — the workspace copy, outputs, /tmp; a step over it is evicted rather than the node filling |
| `FOLDRUN_SHUTDOWN_GRACE_MS` | how long a stopping worker waits for in-flight steps before releasing its lease and exiting, default 25000 — keep under the pod's termination grace |
| `FOLDRUN_PLATFORM_KEY_ACCOUNTS` | the accounts allowed to run on the platform's own model credential (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, the key file), comma-separated — the operator's own. Every other account brings an API key (Settings → Model, `foldrun account model set`), and a step without one is refused before it starts; a Claude login token is refused as such an account's key. Unset or `*`: every account, as before — right for a laptop or a single-owner install. Set on worker and web alike. On the hosted platform it is fail-closed and decided per account ([operator settings](#operator-settings)) |
| `FOLDRUN_EGRESS_URL` | where a step reaches the worker's egress proxy (`http://foldrun-egress.foldrun.svc.cluster.local:8090` on the cluster; `http://host.docker.internal:8090` on a compose install, the default there). Set, and a step's http tools and model calls send `${NAME}` placeholders that the worker fills at the boundary — the credential never enters the sandbox. Unset, and steps materialise secrets into the sandbox as before |
| `FOLDRUN_EGRESS_PORT` | the port the proxy listens on, default 8090 |
| `FOLDRUN_NETWORK_ENFORCE` | `1` makes the egress proxy refuse a site off a step's [`network:`](network) list, and on a cluster labels the step's pod so its network policy gives it the proxy and DNS but not the world. Unset, the proxy only reports: a site off the list is allowed and named in the trace once per step, so an install learns which sites its agents use before anything is refused. An account or workspace can refuse sooner with `network_enforce: true` in its `AGENTS.md`; this switch only adds to that. Read when the proxy grants each step's lease |
| `FOLDRUN_EGRESS_FORWARD` | `0` turns off the proxy's forward door — the `HTTPS_PROXY` every program in a sandbox sends through, which holds the `network:` list and fills [bound secrets](secrets#bound-to-sites). Steps then get no proxy variables and go direct, and bound secrets materialise like any other. On by default wherever `FOLDRUN_EGRESS_URL` is set |
| `FOLDRUN_EGRESS_IN_WORKER` | `0` stops the worker running its own egress proxy, for a cluster that runs the proxy as its own pods (`FOLDRUN_ROLE=egress`, `foldrun-platform/src/egress.ts`) with the `foldrun-egress` Service pointed at them. A worker restart then no longer cuts every step's model call. Unset, the worker runs it, as before. Needs Redis: the worker writes each step's lease there and the proxy pods read it |
| `FOLDRUN_EGRESS_DRAIN_MS` | how long an egress pod lets calls in flight finish after SIGTERM before it closes them, default 600000 (ten minutes). Keep the pod's `terminationGracePeriodSeconds` longer |
| `FOLDRUN_EGRESS_ALLOW_PRIVATE` | `1` lets outward calls reach private, loopback and link-local addresses — a step through the egress proxy, and the platform's own fetches of a `trigger: watch` URL or an OAuth token endpoint. Off by default, so nothing an account writes can point the platform at its own internal services; turn it on only on a single-account install that needs a machine on its own network |
| `FOLDRUN_EGRESS_LOCAL_LEASES` | `1` keeps egress leases in the worker's memory when Redis is down. Right for one worker only — with several behind a Service, a lease held in one worker's memory is a refusal on every other |
| `FOLDRUN_EGRESS_LEASE_V2` | `1` on the worker: it writes each step's lease in the v2 shape — kept in Redis under the SHA-256 of the lease token (never the token), its grant sealed under a key derived from the token, the record signed with the worker's Ed25519 lease key. A proxy opens it with no account key and no install key. Every egress pod reads both shapes; set this once every egress pod runs a release that reads v2. Unset: v1, sealed under the account key, as before |
| `FOLDRUN_EGRESS_MINIMAL_BOOT` | `1` on an egress pod (`FOLDRUN_ROLE=egress`): boot plugs the platform in and nothing else — no migration, no account keys, no file imports — so the pod can run without `FOLDRUN_SECRET_KEY`. It then refuses v1 leases, with or without the install key (no account keys are loaded to open them); its health answer's `legacyLeases` counts the ones still live, which must be 0 before the key is taken away. Needs the next three, and `FOLDRUN_INSTALL_KEY_ABSENT=1` so nothing can fall back to making a key file |
| `FOLDRUN_EGRESS_LEASE_PUBKEY` | the public half of the worker's lease-signing key (base64 SPKI DER, or PEM), for an egress pod without the install key: a v2 lease that does not verify under it is refused. Derived from the install key — `FOLDRUN_SECRET_KEY=… node --experimental-strip-types foldrun-platform/src/egress-keys.ts --print` prints it and the next two. Given beside `FOLDRUN_SECRET_KEY`, each of the three must match what that key derives, or the pod refuses to start |
| `FOLDRUN_EGRESS_CA_PRK` | the egress CA's HKDF key (64 hex), for an egress pod without the install key: the forward door makes, from it, the same CA certificate the worker hands every sandbox. A secret; it signs for the sites secrets are bound to |
| `FOLDRUN_OIDC_SEAL_KEY` | the key the identity signing keys are sealed under (64 hex), for an egress pod without the install key that serves keyless cloud identity (`FOLDRUN_OIDC_ISSUER`). A secret |
| `FOLDRUN_EGRESS_ROTATION_GRACE_MS` | how long the record of a refresh token an OAuth provider rotated mid-step outlives the step's v2 lease, so a refresh still in flight when the step ended is saved too, default 120000. The worker writes each rotated refresh token to the vault copy it came from on its heartbeat and at release |
| `FOLDRUN_EGRESS_ORPHAN_MS` | how long a run's driver may be silent before any worker's recovery loop (once a minute) takes on that run's live v2 leases that hold an unsaved rotated refresh token, and saves it to the vault, default 300000 — for a worker that stopped mid-step and whose run is not resumed |
| `FOLDRUN_EXECUTOR` | `sandbox` (or the older spelling `host`) never uses Docker, even when it is there: steps run in the process, which is right inside a run pod or on a laptop. Unset uses Docker when `docker info` answers: each script call then runs in its own container, with a copy of the agent's folder (what it writes to `outputs/` comes back), the workspace's and the account's `scripts/` and `tools/` read-only, and every `workspace/…` argument copied in and, where the script changed or created it, copied back. A JavaScript script gets Node in its image without a `runtime:` block |
| `FOLDRUN_CONTAINER_CLI` | the container command the runner calls, default `docker` |
| `FOLDRUN_K8S_NAMESPACE` | the namespace run pods, search pods and browser pods are made in, default `foldrun-runs` |
| `FOLDRUN_KUBECTL` | the `kubectl` binary the worker drives the cluster with, default `kubectl` on the path |
| `FOLDRUN_RUNTIME_CACHE` | `off` stops caching the packages a `runtime:` installs; every step then installs fresh. On by default for container isolation (one Docker volume per account) |
| `FOLDRUN_RUNTIME_CACHE_PVC` | on a cluster, the PersistentVolumeClaim that caches `runtime:` packages between steps. Unset means no cache — deliberately, because a name pointing at a claim that does not exist leaves every run pod Pending |
| `FOLDRUN_RUNTIME_MAX_AGE_DAYS` | a cached `runtime:` environment nobody has used for this many days is pruned the next time one is built, default 30 |
| `FOLDRUN_UV` | `0` builds Python environments with pip instead of uv (and a pinned `python:` the image lacks is then an error, not a download) |
| `FOLDRUN_RUNTIME_SHARED_CACHE` | `0` turns off the shared runtime layer: environments the platform builds once for every account that declares exactly the same packages, kept under the cache claim's `_shared/` and mounted read-only into run pods. On by default whenever `FOLDRUN_RUNTIME_CACHE_PVC` is set; a build writes only its own entry, and a daily janitor removes entries no step has used for `FOLDRUN_RUNTIME_MAX_AGE_DAYS` |
| `FOLDRUN_RUNTIME_WARM` | `0` stops building a deployed workspace's environments ahead of its first step. On by default under k8s isolation |
| `FOLDRUN_RUNTIME_WARM_MS` | the most one deploy-time build may take, default 600000 (10 minutes) |
| `FOLDRUN_RUNTIME_BUILD_TIMEOUT_MS` | how long a step waits for another step already building the same `runtime:` before treating that build as abandoned, default 360000 (6 minutes) |
| `FOLDRUN_RETRY_BASE_MS` | the wait before a step's first `retry:`, default 15000; each retry after doubles it, up to sixteen times this |
| `FOLDRUN_CLAIM_STALE_MS` | how long a queued job's claim may go unrenewed before a worker starting up may take it over, default 1800000 (30 minutes). Checked only at boot, so a long step with no `timeout:` is never stolen from a live worker |
| `FOLDRUN_WORKER_STALE_MS` | how old the worker's last tick may be, while its main thread still runs, before its health check says 503 and the liveness probe replaces it, default 180000 (3 minutes) |
| `FOLDRUN_WORKER_BLOCKED_MS` | how long the worker's main thread may be held by synchronous work before its health check says 503, default 600000 (10 minutes). The health check is answered from its own thread, so a busy worker still answers, with `loopLagMs` saying how long it has been held |
| `FOLDRUN_DISABLE_WORKER`, `FOLDRUN_DISABLE_SCHEDULER` | `1` stops this process running queued jobs, or firing schedules — for a process that should only serve pages. A cluster makes the same split with `FOLDRUN_ROLE` |
| `FOLDRUN_ROLE` | what this process runs: `all` (the default, one process), `web` (the dashboard and API, no runs), `worker` (drives runs and the scheduler), or `egress` (only the egress proxy, `src/egress.ts`; health on 3900, drains on SIGTERM) |
| `FOLDRUN_HOUSEKEEPING_TTL_MS` | how long one worker may hold the housekeeping lease (pruning, accrual) before another assumes it died, default 600000 (10 minutes) |

## Files and storage

| variable | |
|---|---|
| `FOLDRUN_STORAGE_DRIVER` | `s3` for an S3-compatible bucket; unset keeps blobs on the data volume |
| `FOLDRUN_S3_ENDPOINT`, `FOLDRUN_S3_BUCKET`, `FOLDRUN_S3_REGION`, `FOLDRUN_S3_ACCESS_KEY_ID`, `FOLDRUN_S3_SECRET_ACCESS_KEY`, `FOLDRUN_S3_PATH_STYLE` | the bucket |
| `FOLDRUN_STORAGE_MAX_MB` | one object, default 512 |
| `FOLDRUN_STORAGE_QUOTA_MB` | one workspace, default 5120 |

## Data services (optional)

| variable | |
|---|---|
| `FOLDRUN_DATABASE_URL` | Postgres — sessions, audit log, ledger, run queue. Unset: files |
| `FOLDRUN_DATABASE_PASSWORD` | the Postgres password, kept out of the URL so the URL can be logged |
| `FOLDRUN_DATABASE_POOL` | connections per process, default 8. Replicas × this is what Postgres sees |
| `FOLDRUN_MIGRATIONS_DIR` | where the migration files are. Default: the platform's `drizzle/` beside the web server's working directory, the same rule the docs use. Set it only for a layout that differs; a directory with no files fails boot loudly rather than starting with no tables |
| `FOLDRUN_REDIS_URL` | Redis — rate limits, leases, caches. Unset: in-process |
| `FOLDRUN_SEARCH_URL` | a SearXNG instance for the `web` tool's search, answer and monitor when per-account search is off. With it on, the worker replaces this with the account's own pod for every step that searches, and a step whose pod the cluster will not give fails — there is no fallback to this address |
| `FOLDRUN_CAPTCHA_API` | (tests only) a base URL standing in for the captcha solver the browser tool's `captcha` argument would call, so the seam can be driven without a vendor account. Unset in any real install |
| `FOLDRUN_SEARCH_PER_ACCOUNT` | `1` (k8s only) gives each account its own SearXNG pod in the run namespace, started on the first step whose `web` tool may search, answer or monitor on the account's own engine, reaped when idle, billed to the account as small compute plus network |
| `FOLDRUN_SEARCH_IDLE_MS` | how long an account's search pods may sit unused before the pool is reaped, default 900000 (15 minutes) |
| `FOLDRUN_SEARCH_STEPS_PER_POD` | how many of an account's steps one search pod serves before the pool grows by one, default 8 |
| `FOLDRUN_SEARCH_MAX_PODS` | the most search pods one account may have at once, default 3. Since 30 Oct 2026 an [operator setting](#operator-settings), `pods.search_max`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_SEARCH_IMAGE` | the SearXNG image for per-account search pods, by digest |
| `FOLDRUN_BROWSER_PER_ACCOUNT` | `1` (k8s only) gives each account its own browser pod in the run namespace — a Playwright server on the runner image — started on the first step whose `web` tool may browse, handed to the step as `FOLDRUN_BROWSER_WS`, reaped when idle, billed to the account as default-size compute plus network. A pod the cluster will not give means that same engine runs inside the step; a test run is never handed one |
| `FOLDRUN_BROWSER_IDLE_MS` | how long an account's browser pods may sit unused before the pool is reaped, default 900000 (15 minutes) |
| `FOLDRUN_BROWSER_STEPS_PER_POD` | how many of an account's steps one browser pod serves before the pool grows by one, default 2 |
| `FOLDRUN_BROWSER_MAX_PODS` | the most browser pods one account may have at once, default 4. Since 30 Oct 2026 an [operator setting](#operator-settings), `pods.browser_max`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_BROWSER_IMAGE` | the browser pod's image; defaults to `FOLDRUN_RUNNER_IMAGE`, and should stay so — the Playwright protocol is version-locked between the client in the run pod and the server in this one, and the runner image is the one image guaranteed to carry both. That image pins Playwright to one exact version (1.63.0, `foldrun-core/src/run-container.ts`); an override image must carry the same one, and 1.59 or later for `mode=aria` to number elements |
| `FOLDRUN_MODEL_KEY_FILE` | the platform's model credential as a **file**, read fresh for every step rather than held from boot — on a cluster it is the mounted `claude-oauth-token` at `/etc/foldrun/keys/claude-oauth-token`. Refreshing an OAuth token revokes the old one, so a process holding a boot-time copy answers 401 until it is restarted; a mounted secret updates in place and needs no restart. Unset, unreadable or empty falls back to `CLAUDE_CODE_OAUTH_TOKEN` in the environment, which is what a local install and compose use |
| `FOLDRUN_BROWSER_WS` | not set by an operator: the worker sets it in a step's sandbox when the account's browser pod is up — a `ws://` address the `web` tool's browse connects every engine to |
| `FOLDRUN_BROWSER_POD_ONLY`, `FOLDRUN_BROWSER_POD_EVENTS` | not set by an operator: the worker sets them on a step it put on the slim image to browse through the pod. The `web` tool then never launches a browser in the step, reconnects a lost pod (three tries, 1, 2 and 4 seconds apart) and writes each try to the events file, which the step's driver reads after every tool call |
| `FOLDRUN_BROWSER_ENGINE`, `FOLDRUN_BROWSER_USER_AGENT`, `FOLDRUN_BROWSER_COOKIES`, `FOLDRUN_BROWSER_COOKIE_DOMAIN`, `FOLDRUN_BROWSER_DEVICE`, `FOLDRUN_BROWSER_LOCALE`, `FOLDRUN_BROWSER_TIMEZONE`, `FOLDRUN_BROWSER_STORAGE`, `FOLDRUN_BROWSER_STORAGE_ORIGIN`, `FOLDRUN_BROWSER_HEADLESS` | not set by an operator either: the agent's [`web.browse:` block](agents#webbrowse--which-browser-and-how-it-presents-itself) reaches the tool this way, as the defaults a call may still override. `FOLDRUN_BROWSER_LIVE=1` for `live: true`; `FOLDRUN_BROWSER_HEADLESS=0` is set for `headless: false`, and the tool then opens a window, starting Xvfb itself when a Linux step has no `DISPLAY` |
| `FOLDRUN_WEB_SEARCH_VIA` / `…_SECRET`, `FOLDRUN_WEB_FETCH_VIA` / `…_SECRET`, `FOLDRUN_BROWSER_VENDOR` / `FOLDRUN_BROWSER_SECRET` | not set by an operator: when an agent names a provider (`web: {search: brave}`, `web: {browse: browserbase}`), the step's tool is told which one and the vault NAME of its key this way. A step with `FOLDRUN_BROWSER_VENDOR` gets no account browser pod |
| `FOLDRUN_WEB_CRAWL_VIA`, `…_MAP_VIA`, `…_EXTRACT_VIA`, `…_ANSWER_VIA`, `…_MONITOR_VIA`, each with `…_SECRET` | not set by an operator: a provider named for one of the newer actions (`web: {crawl: firecrawl}`), and the vault NAME of its key |
| `FOLDRUN_WEB_ACTIONS` | not set by an operator: the agent's `web: {actions: […]}`, comma-joined; the `web` tool refuses any other action. Unset is all eight |
| `FOLDRUN_WEB_BUILTIN` | not set by an operator: `search=WebSearch` when a model provider answers search with its own server-side tool (`fetch: anthropic` sets nothing: foldrun's own fetch answers it); the `web` tool then points the model at it |
| `FOLDRUN_WEB_SEARCH_ENGINES`, `…_EXCLUDE_ENGINES`, `…_CATEGORIES`, `…_SAFESEARCH`, `…_TIME_RANGE`, `…_TIMEOUT`, `…_PLUGINS`, `…_EXCLUDE_PLUGINS`, `…_DOI_RESOLVER` | not set by an operator: the agent's [`web.search:` settings block](tools#tuning-the-accounts-own-engine) reaches the tool this way — lists comma-joined, safesearch as 0-2 — and the tool turns them into SearXNG request parameters. Only a key the agent wrote is set |

## Limits and housekeeping

| variable | |
|---|---|
| `FOLDRUN_WEBHOOK_DISABLE_DAYS` | how many days running every attempt to a workspace's `notify:` webhook may fail before the next delivery to give up switches it off and the owner is emailed. Unset: 3. Since 30 Oct 2026 an [operator setting](#operator-settings), `webhooks.disable_days`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_WEBHOOK_LOG_DAYS` | how long finished webhook deliveries are kept in the log. Unset: 30 |
| `FOLDRUN_WEBHOOK_TIMEOUT_MS` | how long one webhook attempt may take before it counts as failed. Unset: 8000 |
| `FOLDRUN_UNSUBSCRIBE_TTL_DAYS` | how long the one-click unsubscribe link in an optional mail keeps working. Unset: 180 |
| `FOLDRUN_RETENTION_DAYS` | finished runs older than this are pruned. Since 30 Oct 2026 an [operator setting](#operator-settings), `runs.retention_days`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_MAX_RUN_EXPOSURE` | what admission holds against a spend `budget:` for each run in flight, until its cost is recorded. Unset: the flow's recent run cost, else a cent. Since 30 Oct 2026 an [operator setting](#operator-settings), `billing.max_run_exposure`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_PLAN_WORKSPACES` | how many workspaces an account may create on this install; beyond it creation refuses (402). Since 30 Oct 2026 an [operator setting](#operator-settings), `plan.workspaces`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |

## Operations

| variable | |
|---|---|
| `FOLDRUN_METRICS_TOKEN` | the bearer a scraper presents to `/api/metrics` |
| `FOLDRUN_CSP` | `report-only` sends the dashboard's Content-Security-Policy as `Content-Security-Policy-Report-Only`: violations are reported in the browser, not blocked. Unset: enforced (since 28 Oct 2026). A way back while you find what a page needs, not a setting to leave on |
| `FOLDRUN_STATUS_ORIGINS` | comma-separated origins allowed to read `/api/status` and `/api/status/history` from a browser. Unset: `https://foldrun.io`, `https://www.foldrun.io`, `https://status.foldrun.io` |
| `FOLDRUN_STATUS_PAGE_URL` | where the dashboard's **Status** link and `/status` go. Unset: `https://foldrun.io/status/` |
| `FOLDRUN_STATUS_WEB_URL` | the address the status sampler fetches `/api/healthz` from to judge the dashboard and API. Unset: `FOLDRUN_PUBLIC_URL` — the path a customer takes |
| `FOLDRUN_STATUS_SAMPLE_MS` | how often the status sampler runs, in ms. Unset: 300000 (five minutes) |
| `FOLDRUN_SITE_URL` | the public site `security.txt`'s `Policy:` points at. Unset: `https://foldrun.io` |
| `FOLDRUN_BACKUP_RECIPIENT` | the `age` public key (`age1…`) the database dump taken before a migrating deploy (`foldrun-infra/dev/ci/premigrate-backup.sh`) is encrypted to. Required: unset or invalid, the dump refuses to run and the deploy stops rather than migrate with no way back, and nothing is ever written unencrypted. The private half belongs off the server |
| `FOLDRUN_RESEND_API_KEY` | the platform's own Resend key — run notifications, invites and the low-balance warning go out through it |
| `FOLDRUN_PLATFORM_INVITES_PER_DAY` | how many invite recipients one account may send to per day on the platform's key. Default 25. Since 30 Oct 2026 an [operator setting](#operator-settings), `mail.invites_per_day`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_PLATFORM_MAIL_PER_DAY` | the same cap for the rest of an account's mail on the platform's key (`notify:`, approvals, low balance). Default 200. Sign-in, billing and account notices are never capped; at most 10 recipients per message. Since 30 Oct 2026 an [operator setting](#operator-settings), `mail.per_day`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_EMAIL_FROM` | who that platform mail says it is from (default `foldrun <hello@foldrun.io>`). Since 30 Oct 2026 an [operator setting](#operator-settings), `mail.from`: on foldrun's hosted platform it is edited in the operator console; this variable is its fallback, and how a self-hosted install sets it. |
| `FOLDRUN_OIDC_ISSUER` | turns on keyless cloud identity: this install's public https address (no port, query or fragment), the `iss` of every identity token and where `/.well-known/openid-configuration` and `/.well-known/jwks.json` are read. Unset: the feature is off. Rotate the signing key with `node --experimental-strip-types foldrun-platform/scripts/rotate-oidc-key.ts` where the platform runs |
| `FOLDRUN_IDENTITY_LIVENESS_MS` | how recently a step's driver must have checked in for the egress proxy to issue it an identity token (default 15 minutes: the claim heartbeat plus one late beat) |
| `FOLDRUN_OAUTH_CALLBACK_URL` | the redirect URL OAuth sign-ins use, when the install has one canonical address the providers have registered. Unset: the origin the browser came in on, plus `/api/oauth/callback` |
| `FOLDRUN_SKIP_BREACH_CHECK` | `1` skips checking new passwords against known breaches — for an air-gapped install that cannot reach the check |
| `FOLDRUN_HISTORY` | no longer read (17 Oct 2026): workspace history is always the journal, with a snapshot of the whole source at every revision — see [Backups and restore](backups-and-restore) |
| `RESEND_API_KEY` | an **account secret** — the connection your own agents' `email` tool uses; never used for platform mail when `FOLDRUN_RESEND_API_KEY` is set (the CLI on your machine falls back to it for `notify:`) |

## The CLI

Read by `foldrun` on your own machine, not by the platform.

| variable | |
|---|---|
| `FOLDRUN_URL`, `FOLDRUN_TOKEN` | the platform and API key a command uses — the same as `--url` and `--token` |
| `FOLDRUN_TIMEOUT` | seconds one request to the platform may take (default 30) — the same as `--timeout` |
| `FOLDRUN_CONNECT_PORT` | the loopback port `foldrun connect` listens on for the OAuth redirect, default 8642 — the same as `--port` |
| `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` | the OAuth app `foldrun connect` uses, instead of prompting for it |
| `FOLDRUN_PLAYWRIGHT` | where `foldrun login <site>` finds Playwright, when it is not in a `node_modules` it can see |
| `NO_COLOR` | any value turns off colour in the output |
