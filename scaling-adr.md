# ADR: how foldrun scales — one box, one cluster, big SaaS

Written 2026-08-27, while the design was fresh. This is the plan we execute
WHEN a trigger fires — not before.

## The three planes

| plane | what | today | ceiling |
|---|---|---|---|
| execution | per-step gVisor pods via the k8s API | cluster-native already | the cluster's |
| control | one worker (lease-guarded) + scheduler (lease-guarded) | single process, ~50 concurrent runs | one process's I/O |
| state | files under FOLDRUN_DATA on a RWO PVC | single node | single node |

The worker is light because steps execute in pods: it orchestrates, the
cluster computes. This is why "one worker" is not the bottleneck people
assume — the execution plane scales today.

## Triggers → stages

**Stage B — a real cluster, no rewrite.** Trigger: one node's CPU/RAM can't
host the pods.
- PVC → RWX. Done on the dev cluster 2026-09-15: the data volume and the
  runtime cache are NFS v4.1 through the NFS CSI driver, the same static-PV
  shape the production overlay uses for EFS, so what survives dev survives
  EFS. Two real flows and a day of runs found nothing NFS breaks.
- `FOLDRUN_ROLE=web` × N replicas, `worker` × 1 (Recreate). Both leases
  (scheduler, worker) already enforce singularity at runtime.
- Keep rename-as-claim ONLY with a single worker on RWX — rename atomicity
  over network filesystems is not something to bet N workers on.

**Stage C — big SaaS.** Trigger: any of — a second WORKER needed (control
plane saturated), an HA contract (runs survive host failure), measured
queue depth one host can't drain (see /api/metrics — this is why it
exists).
- Postgres: runs, queue (`SELECT … FOR UPDATE SKIP LOCKED`), ledger,
  sessions. The queue lives in the SAME database as the run records so a
  claim and a status write are one transaction — the property no external
  broker (Redis/Rabbit/SQS) offers without distributed-transaction pain.
  This is why the answer is Postgres and not a broker.
- Workers × N, stateless web × N, scheduler behind a pg advisory lock.
- storage/ stays R2 (already true). Secrets → KMS-backed.
- Workspace SOURCE (the markdown) can stay file/git-shaped — it is the
  product's identity; runs/money/jobs are what outgrow files.

## The seams (why this is a re-plumb, not a rewrite)

All state I/O already routes through three modules:
- `store.ts` — run records and workspace reads
- `ledger.ts` — every dollar
- `queue.ts` — every job

Stage C is a driver behind each seam. Nothing above them changes: not the
grammar, not the runner's semantics, not the UI.

## Standing rules until then

- One worker per data directory **on the file queue** — enforced by the
  worker lease, never by a YAML comment alone. On the Postgres queue the
  lease is per pod: a claim is `FOR UPDATE SKIP LOCKED` and heartbeated, the
  claim honours each account's cap, and a reconcile on any pod leaves a run
  another pod holds alone — so worker pods scale out behind an HPA once the
  data volume is shared (EFS).
- The scheduler ticks from memory. One lease holder (Redis when there is
  one), a full rescan every `FOLDRUN_SCHEDULE_RESCAN_MS`, and a workspace
  re-read only when the platform is told it changed — the tick never walks
  every workspace on a shared filesystem.
- Backups are only backups once they're off the box (R2 `backups/`,
  14-day rotation local, 15-day remote).
- /api/metrics is the tripwire: alert on `foldrun_queue_oldest_pending_seconds`
  sustained above ~600 — that is Stage C's trigger becoming measurable.
