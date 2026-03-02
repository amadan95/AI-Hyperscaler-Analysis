import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getDefaultFromDate, getDefaultLabs, parseDateParam, parseListParam } from "@/lib/api/params";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const from = parseDateParam(searchParams.get("from"), getDefaultFromDate());
  const to = parseDateParam(searchParams.get("to"), new Date());

  const labs = parseListParam(searchParams.get("labs"));
  const sourceTier = parseListParam(searchParams.get("sourceTier"));
  const eventType = parseListParam(searchParams.get("eventType"));
  const minConfidence = Number.parseFloat(searchParams.get("minConfidence") ?? "0.6");

  const where: Prisma.EventWhereInput = {
    publishedAt: { gte: from, lte: to },
    labId: { in: labs.length ? labs : getDefaultLabs() },
    confidence: { gte: Number.isFinite(minConfidence) ? minConfidence : 0.6 },
  };

  if (sourceTier.length) {
    where.sourceTier = { in: sourceTier as Prisma.EnumSourceTierFilter["in"] };
  }

  if (eventType.length) {
    where.eventType = { in: eventType };
  }

  const [events, byLab, bySource] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        lab: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 2000,
    }),
    prisma.event.groupBy({
      by: ["labId"],
      where,
      _count: { _all: true },
    }),
    prisma.event.groupBy({
      by: ["sourceTier"],
      where,
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    from,
    to,
    total: events.length,
    byLab,
    bySource,
    events,
  });
}
