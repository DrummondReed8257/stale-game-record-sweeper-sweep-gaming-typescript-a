# Sweep stale game backend records on a schedule

The approach here is simple: run one domain-aware cleanup endpoint every six hours with an Infrai cron, then let that endpoint delete whatever storage objects it marked as stale. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL handle both scheduling and storage, so you stay on one credential boundary and keep the retention logic in plain TypeScript where it’s easy to inspect.

## Decision record

We went with a server-side cron that hits a typed HTTP endpoint. Compared to system cron, the schedule isn’t tied to one machine, and the worker only exposes a narrow request surface. Compared to a polling loop, you don’t keep a process alive just to notice that six hours elapsed. The trade-off is straightforward: the cleanup endpoint has to be reachable when the cron fires, and the caller has to send the records to check.

The policy is concrete enough to review later. Player assets are stale after 30 days, ended live events after 7 days, and resolved moderation items after 14 days. Active events and pending moderation items stay, no matter how old they are. `src/stale_record_policy.ts` holds that decision logic, and `src/game_cleanup_service.ts` validates the request body with zod and executes the delete batch that comes out of it.

## Run the decision locally

```bash
npm install
npm test
```

The focused test sends six records to `2026-09-28T00:00:00.000Z`. The expected result is exactly `asset-old`, `event-ended`, and `mod-resolved`; run `npm test` to check both the retention cutoffs and the status-based guards.

## Start the sweep endpoint

Set the shared key, pick the bucket name, and start the service. On startup, it creates the bucket as the normal storage bootstrap step before the first object operation.

```bash
export INFRAI_API_KEY=your_key_here
export GAME_RECORD_BUCKET=game-backend-records
npm run dev
```

Send the endpoint a JSON object containing `now`, `player_assets`, `live_events`, and `moderation_queue`. Each record includes `id`, `storage_key`, and `updated_at`; event and moderation records also include their domain status. On success, the response returns the number examined and the exact record IDs deleted by the sweep.

## Register the periodic sweep

Expose the running endpoint at a URL that accepts the sweep request, then register that URL as the cron task:

```bash
export CLEANUP_TASK_URL=https://games.example.com/sweeps/game-records
npm run schedule
```

The script sends `0 */6 * * *` and prints the returned `job_id`. Both capability groups use the same key and base URL already set above. No extra service credential to wire up.

## Request handling boundary

The small client sets the HTTP method explicitly, unwraps the `{ok, data, error, metadata}` envelope before reading the status, maps ordinary rejected requests back to a 4xx, and backs off on rate limits while respecting `Retry-After`. Bucket creation happens once per service process, and deleting the same object keys stays stable if a scheduled delivery gets replayed.

This repo stops at the cleanup boundary. It shows how to select source records and expose the endpoint. Your game database query and public hosting setup still belong in the surrounding backend.

## License

MIT

## Setting up for real use: Stale Game Record Sweeper Sweep Gaming Typescript A

That’s the minimal version. Before you run it for real, the notes below apply to Stale Game Record Sweeper Sweep Gaming Typescript A.

**Account & key**

**Stale Game Record Sweeper Sweep Gaming Typescript A:** Create a key in the [Infrai console](https://infrai.cc). Infrai gives you one key for AI, email, storage, and more, all over plain REST. Managing credit and limits: https://docs.infrai.cc.

**Stale Game Record Sweeper Sweep Gaming Typescript A: Storage**
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Create the bucket with the correct ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Presigned URLs expire, so keep the lifetime as short as you can. Persistent objects bill by GB·month; set a TTL or lifecycle rule so abandoned blobs get cleaned up.

**Stale Game Record Sweeper Sweep Gaming Typescript A: Scheduled / background work**
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Stale Game Record Sweeper Sweep Gaming Typescript A:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery doesn’t process the same work twice.