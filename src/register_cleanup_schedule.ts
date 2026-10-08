import { InfraiCleanupClient } from "./infrai_cleanup_client.js";

const apiKey = process.env.INFRAI_API_KEY;
const taskUrl = process.env.CLEANUP_TASK_URL;
if (!apiKey || !taskUrl) {
  throw new Error("Set INFRAI_API_KEY and CLEANUP_TASK_URL before registering the schedule");
}

const infrai = new InfraiCleanupClient(apiKey);
const jobId = await infrai.createCron("0 */6 * * *", taskUrl);
console.log(JSON.stringify({ scheduled: true, job_id: jobId }));
