import { DropiOrder } from './kpis';
import { cityToDepartment, getDepartmentName, DEPARTMENTS } from '@/lib/data/geo/departments';
import { isEntregado, isCancelado, isDevolucion, isTransit } from '@/lib/utils/status';

export interface DepartmentMetrics {
    code: string;
    name: string;
    totalOrders: number;
    entregados: number;
    cancelados: number;
    devoluciones: number;
    transito: number;
    tasaEntrega: number;
    tasaDevolucion: number;
    fletePromedio: number;
    ingresoTotal: number;
}

export interface CityMetrics {
    city: string;
    totalOrders: number;
    entregados: number;
    devoluciones: number;
    tasaEntrega: number;
    fletePromedio: number;
}

export function aggregateByDepartment(
    orders: DropiOrder[],
    countryCode: string
): DepartmentMetrics[] {
    const deptMap = new Map<string, DropiOrder[]>();

    for (const order of orders) {
        const city = order.CIUDAD || order['CIUDAD DESTINO'] || '';
        const deptCode = cityToDepartment(city, countryCode);
        const key = deptCode || 'OTROS';

        if (!deptMap.has(key)) deptMap.set(key, []);
        deptMap.get(key)!.push(order);
    }

    const results: DepartmentMetrics[] = [];

    for (const [code, deptOrders] of deptMap) {
        // Deduplicate counts by order ID (multi-item orders share the same ID)
        const entregados = new Set(deptOrders.filter(o => isEntregado(o.ESTATUS)).map(o => o.ID)).size;
        const cancelados = new Set(deptOrders.filter(o => isCancelado(o.ESTATUS)).map(o => o.ID)).size;
        const devoluciones = new Set(deptOrders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size;
        const transito = new Set(deptOrders.filter(o => isTransit(o.ESTATUS)).map(o => o.ID)).size;
        const totalOrders = new Set(deptOrders.map(o => o.ID)).size;
        const noCancelados = totalOrders - cancelados || 1;
        const dispatched = entregados + devoluciones || 1;

        // Deduplicate financial sums by order ID (flete/ingreso are per-order, not per-line)
        const seenFlete = new Set<string>();
        let totalFlete = 0;
        deptOrders.forEach(o => { if (o.ID && !seenFlete.has(o.ID)) { seenFlete.add(o.ID); totalFlete += o['PRECIO FLETE'] || 0; } });

        const seenIng = new Set<string>();
        let ingresoTotal = 0;
        deptOrders.filter(o => isEntregado(o.ESTATUS)).forEach(o => { if (o.ID && !seenIng.has(o.ID)) { seenIng.add(o.ID); ingresoTotal += o['TOTAL DE LA ORDEN'] || 0; } });

        results.push({
            code,
            name: code === 'OTROS' ? 'Otros' : getDepartmentName(code, countryCode),
            totalOrders,
            entregados,
            cancelados,
            devoluciones,
            transito,
            tasaEntrega: (entregados / noCancelados) * 100,
            tasaDevolucion: (devoluciones / dispatched) * 100,
            fletePromedio: totalOrders > 0 ? totalFlete / totalOrders : 0,
            ingresoTotal,
        });
    }

    return results.sort((a, b) => b.totalOrders - a.totalOrders);
}

export function aggregateByCityInDepartment(
    orders: DropiOrder[],
    deptCode: string,
    countryCode: string
): CityMetrics[] {
    // Filter orders belonging to this department
    const deptOrders = orders.filter(o => {
        const city = o.CIUDAD || o['CIUDAD DESTINO'] || '';
        const code = cityToDepartment(city, countryCode);
        return (code || 'OTROS') === deptCode;
    });

    const cityMap = new Map<string, DropiOrder[]>();

    for (const order of deptOrders) {
        const city = (order.CIUDAD || order['CIUDAD DESTINO'] || 'Desconocida').trim();
        const key = city.toLowerCase();
        if (!cityMap.has(key)) cityMap.set(key, []);
        cityMap.get(key)!.push(order);
    }

    const results: CityMetrics[] = [];

    for (const [, cityOrders] of cityMap) {
        const displayName = cityOrders[0].CIUDAD || cityOrders[0]['CIUDAD DESTINO'] || 'Desconocida';
        const entregados = new Set(cityOrders.filter(o => isEntregado(o.ESTATUS)).map(o => o.ID)).size;
        const cancelados = new Set(cityOrders.filter(o => isCancelado(o.ESTATUS)).map(o => o.ID)).size;
        const devoluciones = new Set(cityOrders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size;
        const totalOrders = new Set(cityOrders.map(o => o.ID)).size;
        const noCancelados = totalOrders - cancelados || 1;

        const seenFlete = new Set<string>();
        let totalFlete = 0;
        cityOrders.forEach(o => { if (o.ID && !seenFlete.has(o.ID)) { seenFlete.add(o.ID); totalFlete += o['PRECIO FLETE'] || 0; } });

        results.push({
            city: displayName,
            totalOrders,
            entregados,
            devoluciones,
            tasaEntrega: (entregados / noCancelados) * 100,
            fletePromedio: totalOrders > 0 ? totalFlete / totalOrders : 0,
        });
    }

    return results.sort((a, b) => b.totalOrders - a.totalOrders);
}
