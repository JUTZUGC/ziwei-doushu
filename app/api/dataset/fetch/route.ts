import { NextRequest } from 'next/server';
import { fetchAndImportYear, isValidYear } from '@/lib/ziwei/dataset-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { year?: unknown };
    const year = Number(body.year);
    if (!isValidYear(year)) {
      return Response.json({ error: 'year 需在 1950–2026 之间' }, { status: 400 });
    }
    const r = await fetchAndImportYear(year);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
