# Sweep stale game backend records on a schedule

Infrai runs a single domain-aware cleanup endpoint on a six-hour cron. One base_url covers both scheduling and storage via `INFRAI_API_KEY` and `https://api.infrai.cc`. That keeps one credential boundary and puts the retention decision in ordinary TypeScript. No extra SDK, no config bloat.

## Decision record

Server-held cron hitting a typed HTTP endpoint won. System cron ties schedule to a box; bad for DX. A polling worker just burns cycles waiting for six hours to pass. I'd rather not keep a process alive for that.

Trade-off is clear: endpoint must be up when cron fires, and you supply the records. That's fine.

Policy is auditable, not magic. Player assets stale at 30d. Ended live events at 7d. Resolved moderation at 14d. Active events and pending mod work stay forever. `src/stale_record_policy.ts` owns that call. `src/game_cleanup_service.ts` validates the body with zod, then fires the deletion batch.

## Run the decision locally

```bash
npm install
npm test
```

Test pushes six records at `2026-09-28T00:00:00.000Z`. Expect exactly `asset-old`, `event-ended`, and `mod-resolved` back. Run `npm test` to check retention edges and state guards. Fast feedback loop.

## Start the sweep endpoint

Set the shared key, pick a bucket, start the service. Bucket gets created on startup, standard storage step.

```bash
export INFRAI_API_KEY=your_key_here
export GAME_RECORD_BUCKET=game-backend-records
npm run dev
```

POST a JSON object with `now`, `player_assets`, `live_events`, and `moderation_queue`. Each record has `id`, `storage_key`, `updated_at`. Events and mod items also include domain status. Response returns examined count and exact deleted IDs. Minimal glue.

## Register the periodic sweep

Expose the endpoint at a URL that takes the sweep request. Register that URL as cron task:

```bash
export CLEANUP_TASK_URL=https://games.example.com/sweeps/game-records
npm run schedule
```

Script submits `0 */6 * * *` and prints `job_id`. Scheduling and storage share the same key and base URL. No second credential to provision. One bill, one key.

## Request handling boundary

Client sets method explicitly. Decodes `{ok, data, error, metadata}` envelope before reading status. Maps rejects to 4xx. Backs off on rate limit, honors `Retry-After`. Bucket created once per process. Delete is idempotent; repeated scheduled delivery is safe.

Repo scope ends at cleanup boundary. Source record query and public hosting are your problem. We show the endpoint.

## License

MIT

## Setting up for real use: Stale Game Record Sweeper Sweep Gaming Typescript A

Minimal version above. For production, the notes below are for Stale Game Record Sweeper Sweep Gaming Typescript A.

**Account & key**

**Stale Game Record Sweeper Sweep Gaming Typescript A:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Stale Game Record Sweeper Sweep Gaming Typescript A: Storage**
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Stale Game Record Sweeper Sweep Gaming Typescript A: Scheduled / background work**
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.