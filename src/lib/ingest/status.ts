import type { SourceTier } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function upsertSourceStatus(params: {
  labId: string;
  sourceName: string;
  sourceTier: SourceTier;
  eventCount: number;
  etag?: string | null;
  lastModified?: string | null;
  error?: string;
}): Promise<void> {
  const now = new Date();
  const successData = {
    lastRunAt: now,
    eventCount: params.eventCount,
    etag: params.etag ?? undefined,
    lastModified: params.lastModified ?? undefined,
  };

  if (params.error) {
    await prisma.sourceStatus.upsert({
      where: {
        labId_sourceName: {
          labId: params.labId,
          sourceName: params.sourceName,
        },
      },
      update: {
        ...successData,
        lastFailureAt: now,
        lastError: params.error,
      },
      create: {
        labId: params.labId,
        sourceName: params.sourceName,
        sourceTier: params.sourceTier,
        eventCount: params.eventCount,
        etag: params.etag ?? undefined,
        lastModified: params.lastModified ?? undefined,
        lastRunAt: now,
        lastFailureAt: now,
        lastError: params.error,
      },
    });
    return;
  }

  await prisma.sourceStatus.upsert({
    where: {
      labId_sourceName: {
        labId: params.labId,
        sourceName: params.sourceName,
      },
    },
    update: {
      ...successData,
      lastSuccessAt: now,
      lastError: null,
    },
    create: {
      labId: params.labId,
      sourceName: params.sourceName,
      sourceTier: params.sourceTier,
      eventCount: params.eventCount,
      etag: params.etag ?? undefined,
      lastModified: params.lastModified ?? undefined,
      lastRunAt: now,
      lastSuccessAt: now,
    },
  });
}
