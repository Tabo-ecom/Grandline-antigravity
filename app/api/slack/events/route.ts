/**
 * Slack Events API Handler
 * Receives messages from Slack and processes campaign control commands.
 *
 * Flow:
 * 1. User sends message in Slack channel
 * 2. Slack sends event here
 * 3. Parse command with Gemini AI
 * 4. If action requires confirmation → send confirmation message, store pending action
 * 5. User replies "SI" → execute action via Meta API
 * 6. Send result back to Slack channel
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import { decryptSettings } from '@/lib/api/crypto';
import { parseSlackCommand } from '@/lib/services/vega/slack-parser';
import { sendSlackBotMessage, buildConfirmationBlocks } from '@/lib/services/vega/slack-bot';
import {
    updateCampaignBudget,
    updateCampaignStatus,
} from '@/lib/services/vega/meta-control';
import { fetchTodayAdInsights } from '@/lib/services/vega/meta-server';
import type { VegaNotificationConfig } from '@/lib/types/vega';

interface PendingAction {
    id: string;
    action: string;
    entityId: string;
    entityName: string;
    newValue: number | string;
    oldValue?: number | string;
    createdAt: number;
    expiresAt: number;
}

const PENDING_KEY = 'vega_pending_actions';

/** Verify Slack request signature */
function verifySlackSignature(
    body: string,
    signature: string | null,
    timestamp: string | null,
    signingSecret: string,
): boolean {
    if (!signature || !timestamp) return false;

    // Reject requests older than 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) return false;

    const sigBaseString = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', signingSecret);
    hmac.update(sigBaseString);
    const expectedSig = `v0=${hmac.digest('hex')}`;

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig),
    );
}

/** Find the Grand Line user who owns this Slack channel */
async function findUserBySlackChannel(channelId: string): Promise<{ userId: string; config: VegaNotificationConfig } | null> {
    if (!adminDb) return null;

    // Search notification configs for matching slackChannelId
    const prefix = 'vega_notification_config_';
    const snapshot = await adminDb.collection('app_data')
        .where(FieldPath.documentId(), '>=', prefix)
        .where(FieldPath.documentId(), '<', prefix + '\uf8ff')
        .get();

    for (const doc of snapshot.docs) {
        const config = doc.data()?.value as VegaNotificationConfig;
        if (config?.slackChannelId === channelId) {
            const userId = doc.id.slice(prefix.length);
            return { userId, config };
        }
    }

    return null;
}

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    let payload: any;

    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // URL Verification challenge (Slack setup)
    if (payload.type === 'url_verification') {
        return NextResponse.json({ challenge: payload.challenge });
    }

    // Only process event callbacks
    if (payload.type !== 'event_callback') {
        return NextResponse.json({ ok: true });
    }

    const event = payload.event;
    if (!event || event.type !== 'message' || event.subtype || event.bot_id) {
        // Ignore bot messages, edits, etc.
        return NextResponse.json({ ok: true });
    }

    const channelId = event.channel;
    const messageText = event.text || '';

    // Find the user who owns this channel
    const userMatch = await findUserBySlackChannel(channelId);
    if (!userMatch) {
        return NextResponse.json({ ok: true }); // No user found, ignore
    }

    const { userId, config } = userMatch;
    const botToken = config.slackBotToken;
    const signingSecret = config.slackSigningSecret;

    if (!botToken) {
        return NextResponse.json({ ok: true });
    }

    // Verify signature if signing secret is configured
    if (signingSecret) {
        const slackSig = req.headers.get('x-slack-signature');
        const slackTimestamp = req.headers.get('x-slack-request-timestamp');
        if (!verifySlackSignature(rawBody, slackSig, slackTimestamp, signingSecret)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    }

    // Check for pending action confirmation
    const upperText = messageText.trim().toUpperCase();
    if (upperText === 'SI' || upperText === 'SÍ' || upperText === 'YES') {
        await handleConfirmation(userId, botToken, channelId);
        return NextResponse.json({ ok: true });
    }
    if (upperText === 'NO' || upperText === 'CANCELAR') {
        await adminSetAppData(PENDING_KEY, null, userId);
        await sendSlackBotMessage(botToken, channelId, '❌ Acción cancelada.');
        return NextResponse.json({ ok: true });
    }

    // Get user's campaigns for context
    let campaignNames: string[] = [];
    try {
        const settingsDoc = await adminDb!.collection('app_data').doc(`ad_settings_${userId}`).get();
        if (settingsDoc.exists) {
            const settings = decryptSettings(settingsDoc.data()?.value);
            const fbToken = settings.fb_token;
            const fbAccounts = settings.fb_account_ids || [];
            if (fbToken && fbAccounts.length > 0) {
                const insights = await fetchTodayAdInsights(fbToken, fbAccounts[0].id);
                campaignNames = insights.map(c => c.campaignName);
            }
        }
    } catch { /* ignore */ }

    // Parse command
    const command = await parseSlackCommand(messageText, campaignNames);

    if (command.action === 'unknown') {
        await sendSlackBotMessage(
            botToken,
            channelId,
            '🤖 No entendí el comando. Puedes decir:\n• "Sube presupuesto de [campaña] un 20%"\n• "Pausa [campaña]"\n• "Activa [campaña]"\n• "Estado de campañas"',
        );
        return NextResponse.json({ ok: true });
    }

    if (command.action === 'status') {
        await handleStatusRequest(userId, botToken, channelId);
        return NextResponse.json({ ok: true });
    }

    // Find matching campaign
    if (!command.entityName) {
        await sendSlackBotMessage(botToken, channelId, '🤖 ¿Qué campaña? Menciona el nombre.');
        return NextResponse.json({ ok: true });
    }

    const matchedCampaign = campaignNames.find(
        n => n.toLowerCase().includes(command.entityName!.toLowerCase()),
    );

    if (!matchedCampaign) {
        await sendSlackBotMessage(
            botToken,
            channelId,
            `🤖 No encontré la campaña "${command.entityName}". Campañas activas:\n${campaignNames.slice(0, 10).map(n => `• ${n}`).join('\n')}`,
        );
        return NextResponse.json({ ok: true });
    }

    // Build confirmation
    let detail = '';
    let newValue: number | string = '';

    if (command.action === 'pause') {
        detail = 'Se pausará esta campaña';
        newValue = 'PAUSED';
    } else if (command.action === 'enable') {
        detail = 'Se activará esta campaña';
        newValue = 'ACTIVE';
    } else if (command.action === 'increase_budget' || command.action === 'decrease_budget') {
        const direction = command.action === 'increase_budget' ? 'Subir' : 'Bajar';
        const amountText = command.isPercentage ? `${command.amount}%` : `$${command.amount?.toLocaleString()}`;
        detail = `${direction} presupuesto: ${amountText}`;
        newValue = command.amount || 0;
    }

    // Store pending action
    const insights = campaignNames.length > 0
        ? (await fetchCampaignId(userId, matchedCampaign))
        : null;

    const pendingAction: PendingAction = {
        id: `action_${Date.now()}`,
        action: command.action,
        entityId: insights?.campaignId || matchedCampaign,
        entityName: matchedCampaign,
        newValue,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    await adminSetAppData(PENDING_KEY, pendingAction, userId);

    const actionLabel = {
        increase_budget: 'Subir presupuesto',
        decrease_budget: 'Bajar presupuesto',
        pause: 'Pausar',
        enable: 'Activar',
    }[command.action] || command.action;

    const blocks = buildConfirmationBlocks(matchedCampaign, actionLabel, detail);
    await sendSlackBotMessage(botToken, channelId, `Confirmación: ${actionLabel} - ${matchedCampaign}`, blocks);

    return NextResponse.json({ ok: true });
}

async function handleConfirmation(userId: string, botToken: string, channelId: string) {
    const pending = await adminGetAppData<PendingAction>(PENDING_KEY, userId);
    if (!pending || Date.now() > pending.expiresAt) {
        await sendSlackBotMessage(botToken, channelId, '⏰ No hay acciones pendientes o la confirmación expiró.');
        await adminSetAppData(PENDING_KEY, null, userId);
        return;
    }

    // Get Meta token
    const settingsDoc = await adminDb!.collection('app_data').doc(`ad_settings_${userId}`).get();
    if (!settingsDoc.exists) {
        await sendSlackBotMessage(botToken, channelId, '❌ No hay configuración de ads.');
        return;
    }

    const settings = decryptSettings(settingsDoc.data()?.value);
    const fbToken = settings.fb_token;

    if (!fbToken) {
        await sendSlackBotMessage(botToken, channelId, '❌ Token de Facebook no configurado.');
        return;
    }

    let result;

    switch (pending.action) {
        case 'pause':
            result = await updateCampaignStatus(fbToken, pending.entityId, 'PAUSED');
            break;
        case 'enable':
            result = await updateCampaignStatus(fbToken, pending.entityId, 'ACTIVE');
            break;
        case 'increase_budget':
        case 'decrease_budget':
            // For percentage-based changes, we need the current budget
            // For now, treat newValue as the absolute budget
            result = await updateCampaignBudget(fbToken, pending.entityId, pending.newValue as number);
            break;
        default:
            await sendSlackBotMessage(botToken, channelId, '❌ Acción no reconocida.');
            return;
    }

    // Clear pending action
    await adminSetAppData(PENDING_KEY, null, userId);

    if (result?.success) {
        await sendSlackBotMessage(botToken, channelId, `✅ *${pending.entityName}* — Acción ejecutada exitosamente.`);
    } else {
        await sendSlackBotMessage(botToken, channelId, `❌ Error: ${result?.error || 'Error desconocido'}`);
    }
}

async function handleStatusRequest(userId: string, botToken: string, channelId: string) {
    try {
        const settingsDoc = await adminDb!.collection('app_data').doc(`ad_settings_${userId}`).get();
        if (!settingsDoc.exists) {
            await sendSlackBotMessage(botToken, channelId, '❌ No hay configuración de ads.');
            return;
        }

        const settings = decryptSettings(settingsDoc.data()?.value);
        const fbToken = settings.fb_token;
        const fbAccounts = settings.fb_account_ids || [];

        if (!fbToken || fbAccounts.length === 0) {
            await sendSlackBotMessage(botToken, channelId, '❌ Sin cuentas de Facebook configuradas.');
            return;
        }

        const insights = await fetchTodayAdInsights(fbToken, fbAccounts[0].id);
        const active = insights.filter(c => c.spend > 0);

        if (active.length === 0) {
            await sendSlackBotMessage(botToken, channelId, '📊 No hay campañas activas con gasto hoy.');
            return;
        }

        const totalSpend = active.reduce((s, c) => s + c.spend, 0);
        const totalConv = active.reduce((s, c) => s + c.conversions, 0);
        const currency = active[0]?.currency || 'COP';
        const fmt = (n: number) => currency === 'COP' ? `$${Math.round(n).toLocaleString('es-CO')}` : `$${n.toFixed(2)}`;

        const lines = [
            `📊 *Estado de Campañas* — ${active.length} activas`,
            `💰 Gasto total: ${fmt(totalSpend)} | Conv: ${totalConv}`,
            '',
        ];

        for (const c of active.sort((a, b) => b.spend - a.spend).slice(0, 10)) {
            const emoji = c.roas > 1 ? '🟢' : c.conversions > 0 ? '🟡' : '🔴';
            lines.push(`${emoji} ${c.campaignName}: ${fmt(c.spend)} | ${c.conversions} conv | ROAS ${c.roas.toFixed(2)}x`);
        }

        await sendSlackBotMessage(botToken, channelId, lines.join('\n'));
    } catch (err: any) {
        await sendSlackBotMessage(botToken, channelId, `❌ Error: ${err?.message || 'Error al obtener estado'}`);
    }
}

async function fetchCampaignId(userId: string, campaignName: string): Promise<{ campaignId: string } | null> {
    try {
        const settingsDoc = await adminDb!.collection('app_data').doc(`ad_settings_${userId}`).get();
        if (!settingsDoc.exists) return null;

        const settings = decryptSettings(settingsDoc.data()?.value);
        const fbToken = settings.fb_token;
        const fbAccounts = settings.fb_account_ids || [];

        if (!fbToken || fbAccounts.length === 0) return null;

        const insights = await fetchTodayAdInsights(fbToken, fbAccounts[0].id);
        const match = insights.find(c => c.campaignName.toLowerCase().includes(campaignName.toLowerCase()));
        return match ? { campaignId: match.campaignId } : null;
    } catch {
        return null;
    }
}
