import { NextResponse } from 'next/server';
import { orchestrateCrawlers } from './orchestrator';

export async function GET() {
  console.log('API /api/crawl called');
  try {
    const result = await orchestrateCrawlers({ companies: 'all' });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.log('Crawler error:', err);
    return NextResponse.json({ ok: false, error: String(err) });
  }
} 