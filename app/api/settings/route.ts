import { NextResponse } from "next/server";
import { defaultSettings } from "@/lib/domain/settings";

export async function GET() {
  return NextResponse.json(defaultSettings);
}
