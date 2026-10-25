# ADR: what becomes a database when this becomes a PaaS

Written 2026-08-29. Sequels [[scaling-adr]], which said *when* to move state off
files. This says *what* moves, *where*, and in what order — and names the two
things that are not a storage problem at all.

## The rule

**Markdown for what people author. Postgres for what the system accumulates.**

Workspaces, agents, flows, skills and knowledge stay files. They are the
product's identity and the reason to choose it. Runs, money, jobs, identity and
audit are records, not documents: they need transactions, indexes and
concurrent writers, and every symptom below is one of those three missing.

## Postgres, not a broker — and Redis for what Postgres is bad at

The queue goes in the SAME database as the run records, so a claim and a status
write are one transaction. No external broker offers that without
distributed-transaction pain. This is settled in [[scaling-adr]] and is not
reopened by adding Redis.

Redis earns its place on the things Postgres is genuinely poor at:

| Redis | why not Postgres |
|---|---|
| login rate limiting | a write per attempt, discardable, needs no durability |
| worker/scheduler leases | `SET NX PX` is the primitive; a lease file over NFS is not |
| SSE fan-out to N web replicas | pub/sub; polling the DB per connection does not scale |
| hot reads (workspace listings) | cache, invalidated on write |

**The tables are code.** `foldrun-platform/src/schema.ts` is Drizzle's
description of every table, and every query in the platform and the web
server is typed against it — a query cannot name a column that does not
exist, and a row comes back in the shape the schema says. A change to the
schema becomes the next migration by `npm run db:generate`, written to
`drizzle/NNNN_<name>.sql`; the platform's own runner applies the files in
name order at boot under an advisory lock and records each by name.
`0000_baseline.sql` is the eight migrations the platform shipped with, folded
into one idempotent file, so a database that ran them under their old names
needs nothing from it. drizzle-kit writes the files; it never applies them —
a schema change reaches production as a reviewed file, not as a diff pushed
from a laptop. The queue's claim stays one SQL statement inside Drizzle's
`sql` template, because its exact shape (the locking clause, the scalar
subquery, the ordering) is the feature. The web server imports Drizzle's
operators through the platform's `orm` barrel and never lists drizzle-orm
itself, so there is exactly one copy of the ORM in the process.

Redis holds **nothing that cannot be rebuilt**. If it is wiped the platform
degrades — colder reads, a re-elected worker — and loses no customer data. That
is the test for whether something belongs there.

## What the code said, and what it says now

Measured, not guessed — and kept here with outcomes rather than rewritten,
because the list of what was wrong is the argument for the order below.

| found | state |
|---|---|
| `masterKey()` takes no tenant argument: one key encrypts every tenant's vault | **fixed** — a data key per account, wrapped by the install key |
| `claimNext()` was `readdirSync().sort()`, global FIFO | **fixed** — round-robin by account, now in Postgres |
| `writeUsers()` rewrites the whole array; two signups race, one lost | **open** — moves with identity |
| no session revocation; a stolen cookie lived until it expired | **fixed** — sessions are rows |
| no login rate limiting at all | **fixed** — per-account, and per-IP behind a proxy |
| the ledger summed a file it had just read, so two admissions saw one balance | **fixed** — summed by the database |
| nothing recorded what PEOPLE did | **fixed** — audit log |
| the scheduler scans every tenant × workspace × flow every 30s | **open** — needs `next_fire_at` |
| `/api/metrics` parses every run file to answer one number | **open** — do not scrape it yet |

## Order, and why this order

Marked as of 2026-08-29. Everything DONE below is deployed and verified on the
production box, not merely written.

1. **Rate limiting (Redis).** DONE. Two windows — per-account and per-IP —
   checked before the scrypt call, since an unlimited login endpoint is also an
   unlimited way to spend the box's CPU. The per-IP half only applies behind a
   proxy that reports the caller: measured on this box, klipper makes every
   request appear to come from one cluster address, and a limit keyed on that
   locks every customer out together.
2. **Identity.** Move authentication out rather than growing it. Lockout,
   reset, MFA, revocation and eventually SAML are a person-year to build and a
   permanent liability to own. `users.json` becomes a profile store keyed by
   the provider's subject id — which is what a file is good at.
   **Sessions and audit: DONE**, ahead of the identity work below, because
   they were cheap once the database existed and revocation was the sharpest
   missing thing. Sessions are rows; v1 tokens still verify so deploying it
   signed nobody out, and v1 is still minted where an install has no database.

3. **Per-tenant keys.** **DONE.** A random data key per account, stored
   encrypted under the install key. The install key no longer opens anything
   directly — it opens the keys, which are in Postgres, while the secrets they
   protect are on the data volume: a stolen copy of either half is not a
   compromise. Records carry a marker saying which key wrote them, so a vault
   written before this stays readable and moves at the next boot. Done now
   rather than later because it gets harder with every customer — re-encrypting
   one account's vault is a Tuesday, five hundred is a project.
   The root key is still `FOLDRUN_SECRET_KEY` — a VALUE, so it exists anywhere
   that value lands. A KMS root key is never a value anyone holds, and on EC2
   the instance role means there is no credential to store at all. The provider
   is NOT implemented: there is no AWS account here to test against, and
   untested crypto guarding every account's secrets is worse than none. The
   SEAM is: every wrapped key carries a prefix naming its provider, so accounts
   move one at a time and a half-migrated install reads correctly. Adding AWS
   is two functions and a re-wrap of the small keys — no secret is
   re-encrypted.

   **The backup was the hole this opened.** Per-account keys mean a stolen copy
   of either half is useless — except every nightly archive carried the wrapped
   keys AND, beside it in plain text, the key that unwraps them. The secrets
   file is now sealed with `age` to a public recipient; the box can seal a
   backup and cannot open one, and the private half never touches the machine.
   Verified by pulling a sealed file back out of R2 and decrypting it elsewhere.

   **Deleting an account is a crypto-shred.** There was no way to delete one at
   all. Backups make erasure hard — fourteen archives nobody can scrub one
   customer out of — so deletion destroys the account's key instead, and every
   copy of their ciphertext, everywhere, becomes permanently unreadable.
   Verified on the box: a secret was written, the account deleted, its
   "backup" restored, and the value could not be read. The ledger is kept,
   because money that moved is not a secret and erasing it is its own problem.
4. **Postgres behind the three seams** — `store.ts`, `ledger.ts`, `queue.ts`.
   - `ledger.ts`: **DONE.** NUMERIC not float, a unique index enforcing "a run
     is charged once", history imported at boot, and the JSONL still written so
     the database can be removed again without losing a cent.
   - `queue.ts`: **DONE.** `FOR UPDATE SKIP LOCKED`, in the same database as
     the run records so a claim and a status write can be one transaction.
     Fairness survives as a `seq` column — a job's position within its own
     account's pending jobs — because Postgres refuses FOR UPDATE alongside a
     window function, and SKIP LOCKED is the whole reason to be there. Stale
     claims are reclaimable at any time rather than only at boot, which is what
     lets a second worker pick up after a first is killed.
   - Still to do: a `next_fire_at` index so the scheduler stops scanning every
     tenant × workspace × flow every 30s, and a runs index so `/api/metrics`
     stops reading every file. Do not scrape metrics until that lands.
5. **Multi-node.** **The blockers are gone.** The queue claims with
   `FOR UPDATE SKIP LOCKED` and the worker lease is a Redis `SET NX PX` — a
   single atomic claim with a TTL, rather than a read-decide-write that could
   let two workers both believe they held it. Verified against the running
   Redis: two claimants, exactly one winner; a holder can renew; a non-holder
   can neither take nor release; and it expires with nobody releasing it.
   What is left before `replicas: 2` is not correctness but storage: the run
   RECORDS and the workspaces are still files on a ReadWriteOnce volume, so a
   second worker has to land on the same node. RWX, or moving run records to
   Postgres, is the remaining step.

## What does not change

The flow grammar, the folder format, per-step gVisor isolation, and the
markdown as source of truth. If a step here requires changing one of those,
the step is wrong.

## The part that is not architecture

At one tenant a bad deploy costs an afternoon. With customers the same bug is a
status page, a refund and a support queue. So the early work is not features —
it is the blast radius of failure: whose data one leak reaches (3), whose runs
one noisy tenant delays (4), and whether a stolen session can be ended without
signing out everybody (2).
