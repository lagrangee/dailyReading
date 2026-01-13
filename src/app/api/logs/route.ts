import { NextResponse } from 'next/server';
import { readLogs } from '@/lib/logger';

export async function GET() {
    const logs = await readLogs();
    return NextResponse.json(logs);
}
