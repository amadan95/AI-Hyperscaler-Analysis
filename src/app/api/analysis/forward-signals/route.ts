import { NextResponse } from "next/server";
import { z } from "zod";
import { getForwardSignals } from "@/lib/analysis/forwardSignals";
import {
  getDefaultFromDate,
  getDefaultLabs,
  getDefaultTickers,
  parseDateParam,
  parseListParam,
} from "@/lib/api/params";

const schema = z.object({
  asOf: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  labs: z.string().optional(),
  tickers: z.string().optional(),
  sourceTier: z.enum(["official", "fallback"]).optional(),
  recentDays: z.coerce.number().int().min(1).max(180).optional(),
  signalWindowDays: z.coerce.number().int().refine((value) => [1, 3, 7].includes(value), {
    message: "signalWindowDays must be one of 1,3,7",
  }).optional(),
  minSamples: z.coerce.number().int().min(10).max(2000).optional(),
});

export async function GET(request: Request) {
  try {
    const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
    const input = schema.parse(raw);

    const asOf = parseDateParam(input.asOf ?? null, new Date());
    const from = parseDateParam(input.from ?? null, getDefaultFromDate());
    const to = parseDateParam(input.to ?? null, asOf);
    const labs = parseListParam(input.labs ?? null);
    const tickers = parseListParam(input.tickers ?? null);

    const response = await getForwardSignals({
      asOf,
      from,
      to,
      labs: labs.length ? labs : getDefaultLabs(),
      tickers: tickers.length ? tickers : getDefaultTickers(),
      sourceTier: input.sourceTier ?? "official",
      recentDays: input.recentDays,
      signalWindowDays: input.signalWindowDays,
      minSamples: input.minSamples,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build forward signals",
      },
      { status: 400 },
    );
  }
}
