import assert from "node:assert/strict";
import test from "node:test";
import { selectStaleRecords, sweepRequestSchema } from "../src/stale_record_policy.js";

test("selects only records past each domain retention boundary", () => {
  const input = sweepRequestSchema.parse({
    now: "2026-09-28T00:00:00.000Z",
    player_assets: [
      { id: "asset-old", kind: "player_asset", storage_key: "players/7/old.png", updated_at: "2026-08-01T00:00:00.000Z" },
      { id: "asset-new", kind: "player_asset", storage_key: "players/7/new.png", updated_at: "2026-09-20T00:00:00.000Z" },
    ],
    live_events: [
      { id: "event-ended", kind: "live_event", status: "ended", storage_key: "events/ended.json", updated_at: "2026-09-01T00:00:00.000Z" },
      { id: "event-active", kind: "live_event", status: "active", storage_key: "events/active.json", updated_at: "2026-08-01T00:00:00.000Z" },
    ],
    moderation_queue: [
      { id: "mod-resolved", kind: "moderation_item", status: "resolved", storage_key: "moderation/resolved.json", updated_at: "2026-09-01T00:00:00.000Z" },
      { id: "mod-pending", kind: "moderation_item", status: "pending", storage_key: "moderation/pending.json", updated_at: "2026-08-01T00:00:00.000Z" },
    ],
  });

  assert.deepEqual(selectStaleRecords(input).map((record) => record.id), [
    "asset-old",
    "event-ended",
    "mod-resolved",
  ]);
});
