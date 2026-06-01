import { NextResponse } from "next/server";
import { buildDashboard } from "@/lib/domain/calculations";
import { demoExpenses, demoIncomes, demoTrips } from "@/lib/domain/seed-data";
import { defaultSettings } from "@/lib/domain/settings";

export async function GET() {
  return NextResponse.json(buildDashboard(demoTrips, demoIncomes, demoExpenses, defaultSettings));
}
