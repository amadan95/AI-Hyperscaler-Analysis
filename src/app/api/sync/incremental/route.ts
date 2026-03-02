import { NextResponse } from "next/server";
import { runIncremental } from "@/lib/ingest/pipeline";

export async function POST() {
  try {
    const summary = await runIncremental(new Date());
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Incremental sync failed" },
      { status: 500 },
    );
  }
}
