import type { SourceTier } from "@prisma/client";
import type { LabId } from "@/lib/config";

export type RawEventCandidate = {
  labId: LabId;
  title: string;
  url: string;
  publishedAt: Date;
  summary?: string;
  sourceTier: SourceTier;
  sourceName: string;
};

export type NormalizedEvent = RawEventCandidate & {
  canonicalUrl: string;
  confidence: number;
  eventType: "launch" | "update";
  hash: string;
};

export type SourceIngestResult = {
  sourceName: string;
  labId: LabId;
  sourceTier: SourceTier;
  events: RawEventCandidate[];
  etag?: string | null;
  lastModified?: string | null;
};

export type PriceSeriesRow = {
  ticker: string;
  date: Date;
  close: number;
  dailyReturn: number;
  benchmarkReturn: number;
  abnormalReturn: number;
};

export type EventStudyResult = {
  eventId: string;
  ticker: string;
  window: number;
  rawReturn: number;
  abnormalReturn: number;
  car: number;
  pValue: number;
};
