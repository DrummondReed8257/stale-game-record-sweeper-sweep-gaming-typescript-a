import { createServer } from "node:http";
import { InfraiCleanupClient, InfraiError } from "./infrai_cleanup_client.js";
import { selectStaleRecords, sweepRequestSchema } from "./stale_record_policy.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const bucket = process.env.GAME_RECORD_BUCKET ?? "game-backend-records";
const port = Number(process.env.PORT ?? 3000);
const infrai = new InfraiCleanupClient(apiKey);
let bucketReady: Promise<void> | undefined;

function ensureBucket(): Promise<void> {
  bucketReady ??= infrai.ensureBucket(bucket);
  return bucketReady;
}

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/sweeps/game-records") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = sweepRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const stale = selectStaleRecords(input);

    await ensureBucket();
    if (stale.length > 0) {
      await infrai.deleteObjects(bucket, stale.map((record) => record.storage_key));
    }

    sendJson(response, 200, {
      examined: input.player_assets.length + input.live_events.length + input.moderation_queue.length,
      deleted: stale.map(({ id, kind }) => ({ id, kind })),
    });
  } catch (error) {
    if (error instanceof InfraiError) {
      sendJson(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message,
      });
      return;
    }
    sendJson(response, 400, { error: "Invalid sweep request" });
  }
});

server.listen(port, () => {
  console.log(`Game cleanup service listening on http://localhost:${port}`);
});
