import { getAppData, setAppData } from '../firebase/firestore';
import type { RawTicket } from '../utils/supplierParser';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SupplierTicket {
    id: string;
    fechaTicket: string;
    ticketNumber: string;
    numeroGuia: string;
    transportadora: string;
    fechaSeguimiento?: string;
    resuelto: boolean;
    solucion?: string;
    createdAt: number;
    updatedAt: number;
}

const TICKETS_KEY = 'supplier_tickets';

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getTickets(userId: string): Promise<SupplierTicket[]> {
    if (!userId) return [];
    const data = await getAppData<SupplierTicket[]>(TICKETS_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function saveTicket(ticket: SupplierTicket, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getTickets(userId);
    const filtered = current.filter(t => t.id !== ticket.id);
    await setAppData(TICKETS_KEY, [...filtered, { ...ticket, updatedAt: Date.now() }], userId);
}

export async function deleteTicket(ticketId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getTickets(userId);
    const filtered = current.filter(t => t.id !== ticketId);
    await setAppData(TICKETS_KEY, filtered, userId);
}

export async function bulkImportTickets(
    rawTickets: RawTicket[],
    userId: string
): Promise<{ imported: number; skipped: number }> {
    if (!userId) return { imported: 0, skipped: 0 };
    const current = await getTickets(userId);
    const existingGuias = new Set(current.map(t => t.numeroGuia));

    const now = Date.now();
    const toImport: SupplierTicket[] = rawTickets
        .filter(t => t.ticketNumber && !existingGuias.has(t.numeroGuia))
        .map((t, i) => ({
            id: `ticket_${now}_${i}`,
            fechaTicket: t.fechaTicket,
            ticketNumber: t.ticketNumber,
            numeroGuia: t.numeroGuia,
            transportadora: t.transportadora,
            fechaSeguimiento: t.fechaSeguimiento || undefined,
            resuelto: t.resuelto,
            solucion: t.solucion || undefined,
            createdAt: now,
            updatedAt: now,
        }));

    const skipped = rawTickets.length - toImport.length;

    if (toImport.length > 0) {
        await setAppData(TICKETS_KEY, [...current, ...toImport], userId);
    }

    return { imported: toImport.length, skipped };
}
