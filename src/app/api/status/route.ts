import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [sources, latestRun] = await Promise.all([
    prisma.sourceStatus.findMany({
      include: { lab: true },
      orderBy: [{ labId: "asc" }, { sourceName: "asc" }],
    }),
    prisma.syncRun.findFirst({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    sources,
    latestRun,
  });
}
