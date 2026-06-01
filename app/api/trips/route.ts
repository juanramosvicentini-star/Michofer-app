import { NextResponse } from "next/server";
import { z } from "zod";
import { demoTrips } from "@/lib/domain/seed-data";
import { hasDatabaseUrl } from "@/lib/env";

const tripSchema = z.object({
  date: z.string(),
  time: z.string().default("09:00"),
  driverId: z.string(),
  clientId: z.string().optional(),
  corporateClientId: z.string().optional(),
  passenger: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  kilometers: z.number().nonnegative(),
  waitValue: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative(),
  chargeType: z.enum(["COBRADO_EN_EL_MOMENTO", "PENDIENTE", "ADELANTADO"]),
  paymentMethod: z.enum([
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
  ]),
  sharedTrip: z.boolean().default(false),
  secondPassenger: z.string().optional(),
  observations: z.string().optional()
}).refine((value) => value.clientId || value.corporateClientId, {
  message: "clientId o corporateClientId es requerido"
});

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ mode: "demo", data: demoTrips });
  }

  const { prisma } = await import("@/lib/prisma");
  const trips = await prisma.trip.findMany({
    include: { driver: true, client: true },
    orderBy: { date: "desc" },
    take: 200
  });

  return NextResponse.json({ mode: "database", data: trips });
}

export async function POST(request: Request) {
  const parsed = tripSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de viaje invalidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        mode: "demo",
        message: "DATABASE_URL no configurada. Se devuelve el viaje calculado sin persistir.",
        data: payload
      },
      { status: 201 }
    );
  }

  const { prisma } = await import("@/lib/prisma");
  const clientId = payload.clientId ?? payload.corporateClientId;

  const trip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        date: new Date(payload.date),
        time: payload.time,
        driverId: payload.driverId,
        clientId: clientId!,
        passenger: payload.passenger,
        origin: payload.origin,
        destination: payload.destination,
        kilometers: payload.kilometers,
        waitValue: payload.waitValue,
        totalAmount: payload.totalAmount,
        chargeType: payload.chargeType,
        paymentMethod: payload.paymentMethod,
        sharedTrip: payload.sharedTrip,
        secondPassenger: payload.secondPassenger,
        status: "PENDING",
        observations: payload.observations
      }
    });

    await tx.auditLog.create({
      data: {
        entity: "Trip",
        entityId: created.id,
        action: "CREATE",
        metadata: JSON.parse(JSON.stringify(payload))
      }
    });

    return created;
  });

  return NextResponse.json(trip, { status: 201 });
}
