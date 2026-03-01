/**
 * Campaign Control API
 * POST: Update campaign/adset budget or status via Meta API.
 * Requires user auth + stores audit log in Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { adminDb } from '@/lib/firebase/admin';
import { decryptSettings } from '@/lib/api/crypto';
import {
    updateCampaignBudget,
    updateAdSetBudget,
    updateCampaignStatus,
    updateAdSetStatus,
} from '@/lib/services/vega/meta-control';

interface ControlRequest {
    action: 'update_budget' | 'pause' | 'enable';
    entityType: 'campaign' | 'adset';
    entityId: string;
    entityName?: string;
    budgetAmount?: number; // In local currency (COP/USD), API converts to centavos
}

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const rl = checkRateLimit(`${auth.uid}:campaign-control`, { max: 20 });
        if (!rl.success) return rateLimitResponse();

        const body = await req.json() as ControlRequest;
        const { action, entityType, entityId, entityName, budgetAmount } = body;

        if (!action || !entityType || !entityId) {
            return NextResponse.json(
                { error: 'Faltan campos: action, entityType, entityId' },
                { status: 400 },
            );
        }

        if (action === 'update_budget' && (!budgetAmount || budgetAmount <= 0)) {
            return NextResponse.json(
                { error: 'budgetAmount debe ser mayor a 0' },
                { status: 400 },
            );
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Database not available' }, { status: 500 });
        }

        // Get user's Meta token
        const settingsDoc = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsDoc.exists) {
            return NextResponse.json(
                { error: 'No hay configuración de ads. Conecta tu cuenta de Facebook primero.' },
                { status: 400 },
            );
        }

        const settings = decryptSettings(settingsDoc.data()?.value);
        const fbToken = settings.fb_token;

        if (!fbToken) {
            return NextResponse.json(
                { error: 'Token de Facebook no configurado' },
                { status: 400 },
            );
        }

        // Execute action
        let result;

        switch (action) {
            case 'update_budget':
                result = entityType === 'adset'
                    ? await updateAdSetBudget(fbToken, entityId, budgetAmount!)
                    : await updateCampaignBudget(fbToken, entityId, budgetAmount!);
                break;

            case 'pause':
                result = entityType === 'adset'
                    ? await updateAdSetStatus(fbToken, entityId, 'PAUSED')
                    : await updateCampaignStatus(fbToken, entityId, 'PAUSED');
                break;

            case 'enable':
                result = entityType === 'adset'
                    ? await updateAdSetStatus(fbToken, entityId, 'ACTIVE')
                    : await updateCampaignStatus(fbToken, entityId, 'ACTIVE');
                break;

            default:
                return NextResponse.json(
                    { error: `Acción inválida: ${action}` },
                    { status: 400 },
                );
        }

        // Audit log
        const logEntry = {
            userId: auth.uid,
            teamId: auth.teamId,
            action,
            entityType,
            entityId,
            entityName: entityName || entityId,
            budgetAmount: budgetAmount || null,
            success: result.success,
            error: result.error || null,
            timestamp: Date.now(),
        };

        adminDb.collection('app_data')
            .doc(`vega_campaign_actions_${auth.teamId}`)
            .set(
                { value: { logs: (await getExistingLogs(auth.teamId)).concat(logEntry).slice(-100) } },
                { merge: true },
            )
            .catch(() => {});

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Error al ejecutar acción en Meta' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            action,
            entityId,
            entityName: entityName || entityId,
            budgetAmount,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error?.message || 'Error en campaign control' },
            { status: 500 },
        );
    }
}

async function getExistingLogs(teamId: string): Promise<any[]> {
    if (!adminDb) return [];
    try {
        const doc = await adminDb.collection('app_data').doc(`vega_campaign_actions_${teamId}`).get();
        return doc.exists ? (doc.data()?.value?.logs || []) : [];
    } catch {
        return [];
    }
}
