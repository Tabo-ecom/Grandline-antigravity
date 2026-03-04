import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendSlackBotMessage } from '@/lib/services/vega/slack-bot';

const TOTAL_SLOTS = 5;
const COLLECTION = 'diagnostic_claimed_slots';

export async function GET() {
    try {
        if (!adminDb) {
            return NextResponse.json({ slotsUsed: 0, totalSlots: TOTAL_SLOTS });
        }
        const snapshot = await adminDb.collection(COLLECTION).get();
        const slotsUsed = snapshot.size;
        return NextResponse.json({ slotsUsed, totalSlots: TOTAL_SLOTS });
    } catch (error) {
        console.error('[Slots API] Error:', error);
        return NextResponse.json({ slotsUsed: 0, totalSlots: TOTAL_SLOTS });
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
        }

        const { name, email, whatsapp } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
        }

        const snapshot = await adminDb.collection(COLLECTION).get();
        const slotsUsed = snapshot.size;
        const isSlotAvailable = slotsUsed < TOTAL_SLOTS;

        await adminDb.collection(COLLECTION).add({
            name: name || '',
            email,
            whatsapp: whatsapp || '',
            type: isSlotAvailable ? 'access' : 'waitlist',
            slotNumber: isSlotAvailable ? slotsUsed + 1 : null,
            createdAt: new Date().toISOString(),
        });

        // Slack notification
        const token = process.env.SLACK_BOT_TOKEN;
        const channel = process.env.SLACK_LEADS_CHANNEL_ID;
        if (token && channel) {
            const lines = isSlotAvailable
                ? [
                    `:dart: *NUEVO SLOT RECLAMADO (${slotsUsed + 1}/${TOTAL_SLOTS})*`,
                    `*Nombre:* ${name || 'N/A'}`,
                    `*Email:* ${email}`,
                    `*WhatsApp:* ${whatsapp || 'N/A'}`,
                    `*Tipo:* Acceso 1 mes gratis`,
                ]
                : [
                    `:clipboard: *Nueva inscripcion lista de espera*`,
                    `*Nombre:* ${name || 'N/A'}`,
                    `*Email:* ${email}`,
                    `*Tipo:* Lista de espera (15 dias gratis)`,
                ];
            lines.push(`*Fecha:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
            sendSlackBotMessage(token, channel, lines.join('\n')).catch(() => {});
        }

        return NextResponse.json({
            success: true,
            type: isSlotAvailable ? 'access' : 'waitlist',
            slotNumber: isSlotAvailable ? slotsUsed + 1 : null,
        });
    } catch (error) {
        console.error('[Slots API] Error:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}
