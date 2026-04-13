import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseOrderLine {
    id: string;
    productoId: string;
    variacionId: string;
    nombre: string;
    variacion: string;
    cantidad: number;
    cantidadRecibida: number;
    costoUnitario: number;
    costoTotal: number;
}

export interface LandedCost {
    id: string;
    concepto: string;
    monto: number;
    moneda: 'USD' | 'COP';
    notas?: string;
}

export interface Payment {
    id: string;
    fecha: string;
    monto: number;
    montoCOP: number;
    metodo: 'transferencia' | 'efectivo' | 'LC' | 'otro';
    referencia: string;
    notas?: string;
    createdAt: number;
}

export interface PurchaseDocument {
    id: string;
    nombre: string;
    tipo: 'factura' | 'packing_list' | 'bl_awb' | 'declaracion' | 'comprobante_pago' | 'otro';
    storagePath: string;
    downloadUrl: string;
    createdAt: number;
}

export type PurchaseEstado = 'borrador' | 'confirmada' | 'en_transito' | 'en_aduana' | 'en_produccion' | 'control_calidad' | 'recibida_parcial' | 'recibida' | 'cerrada';
export type PurchaseTipo = 'maritima' | 'aerea' | 'terrestre' | 'courier' | 'desarrollo_local';

export interface PurchaseOrder {
    id: string;
    referencia: string;
    proveedorId: string;
    proveedorNombre: string;
    tipo: PurchaseTipo;
    estado: PurchaseEstado;
    fechaOrden: string;
    fechaEstimadaLlegada: string;
    fechaRealLlegada?: string;
    moneda: 'USD' | 'COP';
    tasaCambio: number;
    notas: string;
    lineas: PurchaseOrderLine[];
    costosAdicionales: LandedCost[];
    pagos: Payment[];
    documentos: PurchaseDocument[];
    createdAt: number;
    updatedAt: number;
}

export interface PurchaseTotals {
    subtotal: number;
    totalCostosAdicionales: number;
    totalCostosAdicionalesCOP: number;
    total: number;
    totalCOP: number;
    totalPagado: number;
    totalPagadoCOP: number;
    saldoPendiente: number;
    saldoPendienteCOP: number;
    porcentajePagado: number;
}

const PURCHASES_KEY = 'supplier_purchases';

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getPurchases(userId: string): Promise<PurchaseOrder[]> {
    if (!userId) return [];
    const data = await getAppData<PurchaseOrder[]>(PURCHASES_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function savePurchase(purchase: PurchaseOrder, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getPurchases(userId);
    const filtered = current.filter(p => p.id !== purchase.id);
    await setAppData(PURCHASES_KEY, [...filtered, { ...purchase, updatedAt: Date.now() }], userId);
}

export async function deletePurchase(purchaseId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getPurchases(userId);
    const filtered = current.filter(p => p.id !== purchaseId);
    await setAppData(PURCHASES_KEY, filtered, userId);
}

// ── Computed Totals ─────────────────────────────────────────────────────────

export function computePurchaseTotals(po: PurchaseOrder): PurchaseTotals {
    const subtotal = po.lineas.reduce((sum, l) => sum + l.costoTotal, 0);

    const totalCostosAdicionales = po.costosAdicionales.reduce((sum, c) => {
        return sum + (c.moneda === po.moneda ? c.monto : c.moneda === 'USD' ? c.monto * po.tasaCambio : c.monto / po.tasaCambio);
    }, 0);

    // costosAdicionales always in COP for display
    const totalCostosAdicionalesCOP = po.costosAdicionales.reduce((sum, c) => {
        return sum + (c.moneda === 'COP' ? c.monto : c.monto * po.tasaCambio);
    }, 0);

    const total = subtotal + totalCostosAdicionales;
    const tasa = po.moneda === 'USD' ? po.tasaCambio : 1;
    const totalCOP = subtotal * tasa + totalCostosAdicionalesCOP;

    const totalPagado = po.pagos.reduce((sum, p) => sum + p.monto, 0);
    const totalPagadoCOP = po.pagos.reduce((sum, p) => sum + p.montoCOP, 0);

    const saldoPendiente = total - totalPagado;
    const saldoPendienteCOP = totalCOP - totalPagadoCOP;
    const porcentajePagado = total > 0 ? (totalPagado / total) * 100 : 0;

    return {
        subtotal, totalCostosAdicionales, totalCostosAdicionalesCOP,
        total, totalCOP, totalPagado, totalPagadoCOP,
        saldoPendiente, saldoPendienteCOP, porcentajePagado,
    };
}

// ── Landed Cost per Unit ────────────────────────────────────────────────────

/** Returns a map of `productoId_variacionId` → landed cost per unit in COP */
export function computeLandedCostPerUnit(po: PurchaseOrder): Map<string, number> {
    const tasa = po.moneda === 'USD' ? po.tasaCambio : 1;
    const subtotal = po.lineas.reduce((sum, l) => sum + l.costoTotal, 0);

    const totalCostosAdicionalesCOP = po.costosAdicionales.reduce((sum, c) => {
        return sum + (c.moneda === 'COP' ? c.monto : c.monto * po.tasaCambio);
    }, 0);

    const result = new Map<string, number>();
    for (const linea of po.lineas) {
        if (linea.cantidad <= 0) continue;
        const baseUnitCOP = linea.costoUnitario * tasa;
        const proportion = subtotal > 0 ? linea.costoTotal / subtotal : 0;
        const additionalPerUnit = linea.cantidad > 0 ? (totalCostosAdicionalesCOP * proportion) / linea.cantidad : 0;
        const key = `${linea.productoId}_${linea.variacionId || 'NO_VAR'}`;
        result.set(key, baseUnitCOP + additionalPerUnit);
    }
    return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function generatePurchaseId(): string {
    return `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateLineId(index: number): string {
    return `ln_${Date.now()}_${index}`;
}

export function generatePaymentId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateCostId(): string {
    return `lc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function generateDocId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const LANDED_COST_CONCEPTS = [
    'Flete Internacional',
    'Seguro',
    'Arancel',
    'IVA Importación',
    'Agente Aduana',
    'Flete Nacional',
    'Almacenaje',
    'Otros',
] as const;

export const ESTADO_LABELS: Record<PurchaseEstado, string> = {
    borrador: 'Borrador',
    confirmada: 'Confirmada',
    en_transito: 'En Tránsito',
    en_aduana: 'En Aduana',
    en_produccion: 'En Producción',
    control_calidad: 'Control Calidad',
    recibida_parcial: 'Recibida Parcial',
    recibida: 'Recibida',
    cerrada: 'Cerrada',
};

export const TIPO_LABELS: Record<PurchaseTipo, string> = {
    maritima: 'Marítima',
    aerea: 'Aérea',
    terrestre: 'Terrestre',
    courier: 'Courier',
    desarrollo_local: 'Desarrollo Local',
};

export const PRODUCTION_COST_CONCEPTS = [
    'Materia Prima',
    'Mano de Obra',
    'Empaque',
    'Etiquetado',
    'Control Calidad',
    'Flete Local',
    'Otros',
] as const;

export const DOC_TYPE_LABELS: Record<PurchaseDocument['tipo'], string> = {
    factura: 'Factura Comercial',
    packing_list: 'Packing List',
    bl_awb: 'BL / AWB',
    declaracion: 'Declaración',
    comprobante_pago: 'Comprobante de Pago',
    otro: 'Otro',
};
