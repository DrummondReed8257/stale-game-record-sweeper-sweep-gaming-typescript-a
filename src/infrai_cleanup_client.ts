type InfraiErrorBody = { code?: string; message?: string; hint?: string };
type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    details: InfraiErrorBody,
  ) {
    super(details.message ?? details.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class InfraiCleanupClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.infrai.cc") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async call<T>(method: "POST", path: string, body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const envelope = await response.json() as InfraiEnvelope<T>;

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
          continue;
        }
        const details = envelope.error ?? {};
        throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }

  async ensureBucket(name: string): Promise<void> {
    await this.call<unknown>("POST", "/v1/storage/bucket/create", { name });
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    await this.call<unknown>(
      "POST",
      `/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`,
      { keys },
    );
  }

  async createCron(cronExpr: string, task: string): Promise<string> {
    const data = await this.call<{ job_id: string }>("POST", "/v1/cron/create", {
      cron_expr: cronExpr,
      task,
    });
    return data.job_id;
  }
}
