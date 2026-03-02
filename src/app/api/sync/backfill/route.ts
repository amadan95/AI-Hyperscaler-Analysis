import { parseISO } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_FROM_DATE } from "@/lib/config";
import { runBackfill } from "@/lib/ingest/pipeline";

const schema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const from = body.from ? parseISO(body.from) : parseISO(DEFAULT_FROM_DATE);
    const to = body.to ? parseISO(body.to) : new Date();

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date input" }, { status: 400 });
    }

    const summary = await runBackfill(from, to);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
