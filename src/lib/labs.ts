import type { SourceAccess } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LABS } from "@/lib/config";

export async function ensureLabs(): Promise<void> {
  for (const lab of LABS) {
    await prisma.lab.upsert({
      where: { id: lab.id },
      update: { name: lab.name },
      create: {
        id: lab.id,
        name: lab.name,
        sourceAccess: "official",
      },
    });
  }
}

export async function updateLabSourceAccess(labId: string): Promise<void> {
  const [officialCount, fallbackCount] = await Promise.all([
    prisma.event.count({ where: { labId, sourceTier: "official" } }),
    prisma.event.count({ where: { labId, sourceTier: "fallback" } }),
  ]);

  let sourceAccess: SourceAccess = "official";
  if (officialCount > 0 && fallbackCount > 0) {
    sourceAccess = "mixed";
  } else if (officialCount === 0 && fallbackCount > 0) {
    sourceAccess = "fallback";
  }

  await prisma.lab.update({
    where: { id: labId },
    data: { sourceAccess },
  });
}
