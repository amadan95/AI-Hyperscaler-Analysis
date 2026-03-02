import { differenceInCalendarDays } from "date-fns";
import { EXCLUSION_KEYWORDS, RELEASE_KEYWORDS } from "@/lib/config";
import { canonicalizeUrl, hashEvent, normalizedTitle } from "@/lib/utils";
import type { NormalizedEvent, RawEventCandidate } from "@/types/domain";

function hasAnyKeyword(input: string, keywords: readonly string[]): boolean {
  const lower = input.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function classifyEvent(candidate: RawEventCandidate): { keep: boolean; confidence: number; eventType: "launch" | "update" } {
  const text = `${candidate.title} ${candidate.summary ?? ""}`.toLowerCase();
  const hasReleaseKeyword = hasAnyKeyword(text, RELEASE_KEYWORDS);
  const hasExclusionKeyword = hasAnyKeyword(text, EXCLUSION_KEYWORDS);

  if (!hasReleaseKeyword) {
    return { keep: false, confidence: 0, eventType: "update" };
  }

  if (hasExclusionKeyword && !hasReleaseKeyword) {
    return { keep: false, confidence: 0, eventType: "update" };
  }

  const launchSignals = ["launch", "introducing", "announcing", "first", "new model", "generally available"];
  const isLaunch = launchSignals.some((keyword) => text.includes(keyword));

  const confidence =
    candidate.sourceTier === "official"
      ? hasReleaseKeyword
        ? 1
        : 0.7
      : hasReleaseKeyword
        ? 0.55
        : 0.4;

  return {
    keep: true,
    confidence,
    eventType: isLaunch ? "launch" : "update",
  };
}

function dedupeByTitleAndDate(events: NormalizedEvent[]): NormalizedEvent[] {
  const kept: NormalizedEvent[] = [];

  for (const event of events) {
    const titleKey = normalizedTitle(event.title);
    const duplicate = kept.find((existing) => {
      if (existing.labId !== event.labId) return false;
      const sameTitle = normalizedTitle(existing.title) === titleKey;
      if (!sameTitle) return false;
      const dayDelta = Math.abs(differenceInCalendarDays(existing.publishedAt, event.publishedAt));
      return dayDelta <= 2;
    });

    if (!duplicate) {
      kept.push(event);
    }
  }

  return kept;
}

export function normalizeEvents(candidates: RawEventCandidate[]): NormalizedEvent[] {
  const sorted = [...candidates].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  const byUrl = new Map<string, NormalizedEvent>();

  for (const candidate of sorted) {
    const { keep, confidence, eventType } = classifyEvent(candidate);
    if (!keep) {
      continue;
    }

    const canonicalUrl = canonicalizeUrl(candidate.url);
    const keyTitle = normalizedTitle(candidate.title);
    const hash = hashEvent(`${candidate.labId}|${keyTitle}|${candidate.publishedAt.toISOString()}|${canonicalUrl}`);

    const normalized: NormalizedEvent = {
      ...candidate,
      canonicalUrl,
      confidence,
      eventType,
      hash,
    };

    if (!byUrl.has(canonicalUrl) || byUrl.get(canonicalUrl)!.confidence < normalized.confidence) {
      byUrl.set(canonicalUrl, normalized);
    }
  }

  const deduped = dedupeByTitleAndDate(Array.from(byUrl.values()));
  return deduped.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
}
