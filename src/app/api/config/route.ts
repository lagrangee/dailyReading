import { NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/config';

export async function GET() {
    const config = await readConfig();
    return NextResponse.json(config);
}

export async function POST(request: Request) {
    const newConfig = await request.json();
    await writeConfig(newConfig);
    return NextResponse.json({ success: true });
}
