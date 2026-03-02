import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "value",
  trimValues: true,
});

export type FetchWithMetaResponse = {
  text: string;
  etag: string | null;
  lastModified: string | null;
  status: number;
};

export async function fetchTextWithRetry(
  url: string,
  init?: RequestInit,
  retries = 3,
  timeoutMs = 25_000,
): Promise<FetchWithMetaResponse> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "user-agent": "hyperscaler-investment-bot/1.0",
          accept: "*/*",
          ...(init?.headers ?? {}),
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return {
        text: await response.text(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      attempt += 1;
      if (attempt >= retries) {
        break;
      }
      const delay = 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch failure");
}

export function parseXml<T = unknown>(xml: string): T {
  return parser.parse(xml) as T;
}

export function asArray<T>(input: T | T[] | undefined | null): T[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
