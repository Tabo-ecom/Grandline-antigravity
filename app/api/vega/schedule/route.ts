import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { getScheduleConfig, saveScheduleConfig } from '@/lib/services/vega/schedule';
import type { VegaScheduleConfig } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const config = await getScheduleConfig(auth.teamId);
        return NextResponse.json(config);
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error fetching schedule config' },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const body = await req.json() as Partial<VegaScheduleConfig>;

        // Merge with existing config to allow partial updates
        const existing = await getScheduleConfig(auth.teamId);
        const updated: VegaScheduleConfig = { ...existing, ...body };

        // Validate timezone
        try {
            Intl.DateTimeFormat('en-US', { timeZone: updated.timezone });
        } catch {
            return NextResponse.json({ error: 'Zona horaria inválida' }, { status: 400 });
        }

        // Validate hour ranges
        if (updated.dailyReport.hour < 0 || updated.dailyReport.hour > 23) {
            return NextResponse.json({ error: 'Hora de reporte diario inválida' }, { status: 400 });
        }
        if (updated.weeklyReport.hour < 0 || updated.weeklyReport.hour > 23) {
            return NextResponse.json({ error: 'Hora de reporte semanal inválida' }, { status: 400 });
        }
        if (updated.weeklyReport.dayOfWeek < 0 || updated.weeklyReport.dayOfWeek > 6) {
            return NextResponse.json({ error: 'Día de la semana inválido' }, { status: 400 });
        }

        await saveScheduleConfig(updated, auth.teamId);
        return NextResponse.json({ success: true, config: updated });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error saving schedule config' },
            { status: 500 },
        );
    }
}
