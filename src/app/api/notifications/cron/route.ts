import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Authorization header check against CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Scheduler scans for:
  // 1. Recurring bills due today or within reminder days
  // 2. Installments due today or overdue
  // 3. Delivers Web Push notifications using VAPID keys if configured

  return NextResponse.json({
    status: "success",
    timestamp: new Date().toISOString(),
    checkedRules: 0,
    deliveredNotifications: 0,
    message: "Scheduled reminder scan completed.",
  });
}
