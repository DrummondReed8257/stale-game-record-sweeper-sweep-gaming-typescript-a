import { z } from "zod";

const storedRecord = z.object({
  id: z.string().min(1),
  storage_key: z.string().min(1),
  updated_at: z.string().datetime(),
});

export const sweepRequestSchema = z.object({
  now: z.string().datetime(),
  player_assets: z.array(storedRecord.extend({ kind: z.literal("player_asset") })),
  live_events: z.array(storedRecord.extend({
    kind: z.literal("live_event"),
    status: z.enum(["scheduled", "active", "ended"]),
  })),
  moderation_queue: z.array(storedRecord.extend({
    kind: z.literal("moderation_item"),
    status: z.enum(["pending", "resolved"]),
  })),
});

export type SweepRequest = z.infer<typeof sweepRequestSchema>;
type SweepRecord = SweepRequest["player_assets"][number]
  | SweepRequest["live_events"][number]
  | SweepRequest["moderation_queue"][number];

const DAY_MS = 86_400_000;

export function selectStaleRecords(input: SweepRequest): SweepRecord[] {
  const now = Date.parse(input.now);
  const olderThan = (record: SweepRecord, days: number) =>
    now - Date.parse(record.updated_at) >= days * DAY_MS;

  return [
    ...input.player_assets.filter((record) => olderThan(record, 30)),
    ...input.live_events.filter((record) => record.status === "ended" && olderThan(record, 7)),
    ...input.moderation_queue.filter((record) => record.status === "resolved" && olderThan(record, 14)),
  ];
}
