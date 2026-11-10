import { syncToday } from "@/lib/krillion-sync";
import { currentDayNumber } from "@/lib/krillion-format";
import { getDay } from "@/lib/db";

// Called by the Vercel Schedules in vercel.json, so prompts and averages get saved even on days
// nobody opens the site. Vercel sends CRON_SECRET as a bearer token; anyone else gets a 401.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  await syncToday(true);
  const day = await getDay(currentDayNumber());
  return Response.json({ dayNumber: currentDayNumber(), prompts: day?.prompts?.length ?? 0, sample: day?.sample ?? null });
}
