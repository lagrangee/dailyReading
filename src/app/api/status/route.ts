import { NextResponse } from 'next/server';
import { sessionExists } from '@/lib/session_manager';

export async function GET() {
    const platforms = ['bilibili', 'youtube', 'notebooklm'] as const;
    const stats: Record<string, boolean> = {};

    for (const p of platforms) {
        stats[p] = await sessionExists(p);
    }

    return NextResponse.json(stats);
}
