import { NextRequest } from 'next/server';
import { getDatasetStatus, getInterpretation, pickDimensions, DIMENSION_LABELS } from '@/lib/ziwei/dataset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    if (p.get('status') === '1') {
      return Response.json(getDatasetStatus());
    }
    const year = Number(p.get('year'));
    const month = Number(p.get('month'));
    const day = Number(p.get('day'));
    const hour = Number(p.get('hour'));
    const gender = p.get('gender');
    if (![year, month, day, hour].every(Number.isInteger) || (gender !== 'male' && gender !== 'female')) {
      return Response.json({ error: '参数不完整：需要 year/month/day/hour/gender' }, { status: 400 });
    }
    const r = getInterpretation({ year, month, day, hour, gender });
    if (!r.available || !r.chart) return Response.json(r, { status: 404 });
    const dims = p.get('dimensions')?.split(',').filter(Boolean);
    return Response.json({
      available: true,
      key: r.key,
      source: r.source,
      license: r.license,
      mingStar: r.chart.mingStar,
      labels: DIMENSION_LABELS,
      dimensions: pickDimensions(r.chart, dims),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    );
  }
}
