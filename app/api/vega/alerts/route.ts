import { NextRequest, NextResponse } from 'next/server';
import { getAlertRules, saveAlertRule, deleteAlertRule, toggleAlertRule } from '@/lib/services/vega/alerts';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import type { VegaAlertRule } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const rules = await getAlertRules(auth.teamId);
        return NextResponse.json({ rules });
    } catch (error) {
        console.error('Error fetching alert rules:', error);
        return NextResponse.json({ error: 'Error al obtener reglas' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { rule } = await req.json();

        if (!rule) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        await saveAlertRule(rule as VegaAlertRule, auth.teamId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving alert rule:', error);
        return NextResponse.json({ error: 'Error al guardar regla' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { ruleId } = await req.json();

        if (!ruleId) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        await deleteAlertRule(ruleId, auth.teamId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting alert rule:', error);
        return NextResponse.json({ error: 'Error al eliminar regla' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { ruleId, enabled } = await req.json();

        if (!ruleId) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        await toggleAlertRule(ruleId, enabled, auth.teamId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error toggling alert rule:', error);
        return NextResponse.json({ error: 'Error al actualizar regla' }, { status: 500 });
    }
}
