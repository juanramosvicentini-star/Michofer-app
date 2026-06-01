import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDatabaseUrl } from "@/lib/env";

const completeTripSchema = z.object({
  paidAt: z.string().optional(),
  paidMethod: z.enum([
    "CASH_MI_CHOFER",
    "CASH_UBER",
    "MERCADO_PAGO",
    "POSNET",
    "BANCO_GALICIA_PAUL",
    "TRANSFER",
    "DOLLARS",
    "USDT",
    "ADVANCE",
    "PENDING",
    "BONIFICADO"
  ]).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = completeTripSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de cobro invalidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      mode: "demo",
      message: "Viaje marcado como concretado en modo demo.",
      id,
      payload
    });
  }

  const { prisma } = await import("@/lib/prisma");
  const trip = await prisma.$transaction(async (tx) => {
    const updated = await tx.trip.update({
      where: { id },
      data: {
        status: "COMPLETED",
        paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
        paidMethod: payload.paidMethod
      }
    });

    await tx.auditLog.create({
      data: {
        entity: "Trip",
        entityId: updated.id,
        action: "COMPLETE",
        metadata: JSON.parse(JSON.stringify(payload))
      }
    });

    return updated;
  });

  return NextResponse.json(trip);
}
