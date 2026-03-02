export const DEFAULT_FROM_DATE = "2023-01-01";

export const LABS = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google-deepmind", name: "Google DeepMind" },
  { id: "meta-ai", name: "Meta AI" },
  { id: "mistral", name: "Mistral" },
  { id: "xai", name: "xAI" },
] as const;

export const HYPERSCALER_TICKERS = [
  { ticker: "MSFT", label: "MSFT", stooq: "msft.us", region: "US" },
  { ticker: "AMZN", label: "AMZN", stooq: "amzn.us", region: "US" },
  { ticker: "GOOG", label: "GOOG", stooq: "goog.us", region: "US" },
  { ticker: "META", label: "META", stooq: "meta.us", region: "US" },
  { ticker: "ORCL", label: "ORCL", stooq: "orcl.us", region: "US" },
  { ticker: "BABA", label: "Alibaba (BABA)", stooq: "baba.us", region: "US" },
  { ticker: "BIDU", label: "BIDU", stooq: "bidu.us", region: "US" },
] as const;

export const BENCHMARK = { ticker: "QQQ", stooq: "qqq.us" } as const;

export const EVENT_WINDOWS = [1, 3, 7] as const;
export const EVENT_LAGS = [0, 1, 3, 7] as const;

export const RELEASE_KEYWORDS = [
  "launch",
  "introducing",
  "release",
  "available",
  "api",
  "model",
  "version",
  "preview",
  "general availability",
  "rollout",
  "shipping",
  "new",
];

export const EXCLUSION_KEYWORDS = [
  "policy",
  "hiring",
  "career",
  "compliance",
  "safety framework",
  "transparency report",
  "election",
  "grant",
  "fellowship",
  "award",
];

export const GOOGLE_NEWS_FALLBACK = {
  "meta-ai": ["ai.meta.com"],
  xai: ["x.ai"],
  openai: ["openai.com"],
  anthropic: ["anthropic.com"],
  "google-deepmind": ["blog.google", "deepmind.google"],
  mistral: ["mistral.ai"],
} as const;

export type LabId = (typeof LABS)[number]["id"];
