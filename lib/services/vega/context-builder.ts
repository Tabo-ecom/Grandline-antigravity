/**
 * Vega AI - Data Context Builder
 * Collects ALL operational data and formats it for AI prompts
 */

import type { KPIResults } from '@/lib/calculations/kpis';
import type { ExtendedDropiOrder } from '@/lib/hooks/useDashboardData';
import { isEntregado, isCancelado, isDevolucion, isTransit } from '@/lib/utils/status';

export interface VegaDataContext {
    kpis: KPIResults | null;
    prevKpis: KPIResults | null;
    orderCount: number;
    countries: string[];
    adPlatformMetrics: { fb: number; tiktok: number; google: number };
    projectedProfit: number;
    metricsByCountry: any[];
    dateRange: string;
    dailySalesData?: any[];
    filteredOrders?: ExtendedDropiOrder[];
    availableProducts?: { id: string; label: string }[];
    filteredAds?: any[];
    logisticStats?: { entregados: number; transito: number; cancelados: number; devoluciones: number };
    berryExpenses?: { category: string; amount: number }[];
    berryExpenseTotal?: number;
    campaignNames?: string[];
}

export function buildDataContext(data: VegaDataContext): string {
    const {
        kpis, prevKpis, orderCount, countries, adPlatformMetrics, projectedProfit,
        metricsByCountry, dateRange, dailySalesData, filteredOrders, availableProducts,
        filteredAds, logisticStats, berryExpenses, berryExpenseTotal, campaignNames
    } = data;

    if (!kpis) return 'No hay datos disponibles para el período seleccionado.';

    const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const lines: string[] = [
        `=== DATOS OPERATIVOS COMPLETOS ===`,
        `Período seleccionado: ${dateRange}`,
        `Fecha de hoy: ${today}`,
        '',
        '--- RESUMEN GENERAL ---',
        `Total Órdenes: ${kpis.n_ord}`,
        `Entregadas: ${kpis.n_ent} (Tasa: ${kpis.tasa_ent.toFixed(1)}%)`,
        `Canceladas: ${kpis.n_can} (Tasa: ${kpis.tasa_can.toFixed(1)}%)`,
        `Devoluciones: ${kpis.n_dev} (Tasa: ${kpis.tasa_dev.toFixed(1)}%)`,
        `En Tránsito: ${kpis.n_tra} (${kpis.n_ord > 0 ? ((kpis.n_tra / kpis.n_ord) * 100).toFixed(1) : '0.0'}% del total)`,
        `No canceladas: ${kpis.n_nc}`,
        '',
        '--- FINANCIEROS ---',
        `Facturación Neta (no cancelados): $${kpis.fact_neto.toLocaleString()}`,
        `Facturación Despachada: $${kpis.fact_despachada.toLocaleString()}`,
        `Ingreso Real (Entregados): $${kpis.ing_real.toLocaleString()}`,
        `Costo Producto (Entregados): $${kpis.cpr.toLocaleString()}`,
        `Flete Entregados: $${kpis.fl_ent.toLocaleString()}`,
        `Flete Devoluciones: $${kpis.fl_dev.toLocaleString()}`,
        `Flete Tránsito: $${kpis.fl_tra.toLocaleString()}`,
        `Gasto Ads Total: $${kpis.g_ads.toLocaleString()}`,
        `Utilidad Real: $${kpis.u_real.toLocaleString()}`,
        `Utilidad Proyectada: $${(kpis.utilidad_proyectada || 0).toLocaleString()}`,
        `Utilidad por Entrega: $${kpis.utilidad_por_entrega.toLocaleString()}`,
        '',
        '--- RENDIMIENTO PUBLICITARIO ---',
        `ROAS Real: ${kpis.roas_real.toFixed(2)}x`,
        `ROAS Bruto: ${kpis.roas_bruto.toFixed(2)}x`,
        `CPA (Costo por Orden): $${kpis.cpa.toLocaleString()}`,
        `CPE (Costo por Entrega): $${kpis.cpe.toLocaleString()}`,
        `% Ads vs Revenue: ${kpis.perc_ads_revenue.toFixed(1)}%`,
        `MER: ${kpis.mer.toFixed(2)}x`,
        `Gasto Facebook: $${adPlatformMetrics.fb.toLocaleString()}`,
        `Gasto TikTok: $${adPlatformMetrics.tiktok.toLocaleString()}`,
        `Gasto Google: $${adPlatformMetrics.google.toLocaleString()}`,
    ];

    // Previous period comparison
    if (prevKpis) {
        lines.push(
            '',
            '--- PERÍODO ANTERIOR (COMPARACIÓN) ---',
            `Órdenes: ${prevKpis.n_ord} (actual: ${kpis.n_ord}, cambio: ${kpis.n_ord - prevKpis.n_ord > 0 ? '+' : ''}${kpis.n_ord - prevKpis.n_ord})`,
            `Entregadas: ${prevKpis.n_ent}`,
            `Tasa Entrega: ${prevKpis.tasa_ent.toFixed(1)}% (actual: ${kpis.tasa_ent.toFixed(1)}%)`,
            `Tasa Cancelación: ${prevKpis.tasa_can.toFixed(1)}% (actual: ${kpis.tasa_can.toFixed(1)}%)`,
            `ROAS Real: ${prevKpis.roas_real.toFixed(2)}x (actual: ${kpis.roas_real.toFixed(2)}x)`,
            `CPA: $${prevKpis.cpa.toLocaleString()} (actual: $${kpis.cpa.toLocaleString()})`,
            `Gasto Ads: $${prevKpis.g_ads.toLocaleString()} (actual: $${kpis.g_ads.toLocaleString()})`,
            `Ingreso Real: $${prevKpis.ing_real.toLocaleString()} (actual: $${kpis.ing_real.toLocaleString()})`,
            `Utilidad Real: $${prevKpis.u_real.toLocaleString()} (actual: $${kpis.u_real.toLocaleString()})`,
        );
    }

    // Detailed country + product breakdown
    if (metricsByCountry.length > 0) {
        lines.push('', '--- MÉTRICAS POR PAÍS Y PRODUCTO (DESGLOSE COMPLETO) ---');
        metricsByCountry.forEach((c: any) => {
            lines.push(
                '',
                `== ${c.name} (${c.currency || 'COP'}) ==`,
                `  Órdenes: ${c.orderCount || 0}`,
                `  Tasa Entrega: ${(c.deliveryRate || 0).toFixed(1)}% | Tasa Cancelación: ${(c.cancelRate || 0).toFixed(1)}%`,
                `  Facturación Neta: $${(c.sales || 0).toLocaleString()}`,
                `  Gasto Ads: $${(c.adSpend || 0).toLocaleString()}`,
                `  Utilidad Real: $${(c.profit || 0).toLocaleString()}`,
                `  Utilidad Proyectada: $${(c.projectedProfit || 0).toLocaleString()}`,
            );

            // Product breakdown within country — DESGLOSE INDIVIDUAL POR PRODUCTO
            if (c.products && c.products.length > 0) {
                lines.push(`  --- Productos en ${c.name} (desglose individual) ---`);
                c.products.forEach((p: any) => {
                    lines.push(
                        `    PRODUCTO: ${p.name} (ID: ${p.id})`,
                        `      Órdenes: ${p.orderCount || 0}`,
                        `      Tasa Entrega: ${(p.deliveryRate || 0).toFixed(1)}% | Tasa Cancel: ${(p.cancelRate || 0).toFixed(1)}%`,
                        `      Ventas Netas: $${(p.netSales || 0).toLocaleString()}`,
                        `      Gasto Ads: $${(p.adSpend || 0).toLocaleString()}`,
                        `      ROAS: ${(p.roas || 0).toFixed(2)}x | CPA: $${(p.cpa || 0).toLocaleString()}`,
                        `      Utilidad Real: $${(p.profit || 0).toLocaleString()}`,
                        `      Utilidad Proyectada: $${(p.projectedProfit || 0).toLocaleString()}`,
                    );
                });
            }
        });
    }

    // Products list
    if (availableProducts && availableProducts.length > 0) {
        lines.push('', '--- PRODUCTOS DISPONIBLES ---');
        availableProducts.forEach(p => {
            lines.push(`  - ID: ${p.id} | Nombre: ${p.label}`);
        });
    }

    // Product summary from orders (aggregated)
    if (filteredOrders && filteredOrders.length > 0) {
        const productStats: Record<string, { orders: number; delivered: number; canceled: number; revenue: number; product: string }> = {};
        const seenIds: Record<string, Set<string>> = {};

        filteredOrders.forEach(o => {
            const pid = o.PRODUCTO?.toString() || o.PRODUCTO_ID?.toString() || 'Sin producto';
            if (!productStats[pid]) {
                productStats[pid] = { orders: 0, delivered: 0, canceled: 0, revenue: 0, product: pid };
                seenIds[pid] = new Set();
            }
            if (o.ID && !seenIds[pid].has(o.ID)) {
                seenIds[pid].add(o.ID);
                productStats[pid].orders++;
                if (isEntregado(o.ESTATUS)) productStats[pid].delivered++;
                if (isCancelado(o.ESTATUS)) productStats[pid].canceled++;
                if (!isCancelado(o.ESTATUS)) productStats[pid].revenue += (o["TOTAL DE LA ORDEN"] || 0);
            }
        });

        const sorted = Object.values(productStats).sort((a, b) => b.orders - a.orders);
        if (sorted.length > 0) {
            lines.push('', '--- RESUMEN POR PRODUCTO (ÓRDENES) ---');
            sorted.slice(0, 20).forEach(p => {
                const deliveryRate = (p.orders - p.canceled) > 0 ? ((p.delivered / (p.orders - p.canceled)) * 100).toFixed(1) : '0.0';
                lines.push(`  ${p.product}: ${p.orders} órd, ${p.delivered} entreg, ${p.canceled} cancel, Entrega=${deliveryRate}%, Fact=$${p.revenue.toLocaleString()}`);
            });
        }

        // City breakdown (top 15)
        const cityStats: Record<string, number> = {};
        filteredOrders.forEach(o => {
            const city = o["CIUDAD DESTINO"] || o.CIUDAD || 'Desconocida';
            if (!cityStats[city]) cityStats[city] = 0;
            cityStats[city]++;
        });
        const topCities = Object.entries(cityStats).sort((a, b) => b[1] - a[1]).slice(0, 15);
        if (topCities.length > 0) {
            lines.push('', '--- TOP CIUDADES ---');
            topCities.forEach(([city, count]) => lines.push(`  ${city}: ${count} órdenes`));
        }
    }

    // Ad campaigns summary — DESGLOSE COMPLETO POR CAMPAÑA
    if (filteredAds && filteredAds.length > 0) {
        const campaignStats: Record<string, {
            spend: number; platform: string; product: string;
            impressions: number; clicks: number; conversions: number;
            revenue: number; leads: number; reach: number; entries: number;
        }> = {};
        filteredAds.forEach((ad: any) => {
            const name = ad.campaignName || 'Sin campaña';
            if (!campaignStats[name]) {
                campaignStats[name] = {
                    spend: 0, platform: ad.platform || '?', product: ad.productId || '?',
                    impressions: 0, clicks: 0, conversions: 0,
                    revenue: 0, leads: 0, reach: 0, entries: 0,
                };
            }
            campaignStats[name].spend += (ad.amount || 0);
            campaignStats[name].impressions += (ad.impressions || 0);
            campaignStats[name].clicks += (ad.clicks || 0);
            campaignStats[name].conversions += (ad.conversions || 0);
            campaignStats[name].revenue += (ad.revenue_attributed || 0);
            campaignStats[name].leads += (ad.leads || 0);
            campaignStats[name].reach += (ad.reach || 0);
            campaignStats[name].entries++;
        });

        const topCampaigns = Object.entries(campaignStats).sort((a, b) => b[1].spend - a[1].spend).slice(0, 20);
        if (topCampaigns.length > 0) {
            lines.push('', '--- MÉTRICAS POR CAMPAÑA (DESGLOSE INDIVIDUAL) ---');
            topCampaigns.forEach(([name, s]) => {
                const ctr = s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '?';
                const roas = s.spend > 0 ? (s.revenue / s.spend).toFixed(2) : '?';
                const cpa = s.conversions > 0 ? Math.round(s.spend / s.conversions).toLocaleString() : '?';
                lines.push(
                    `  CAMPAÑA: ${name}`,
                    `    Plataforma: ${s.platform} | Producto: ${s.product}`,
                    `    Gasto: $${s.spend.toLocaleString()} | Revenue Atribuido: $${s.revenue.toLocaleString()}`,
                    `    ROAS: ${roas}x | CPA: $${cpa}`,
                    `    Conversiones: ${s.conversions} | Leads: ${s.leads}`,
                    `    Impresiones: ${s.impressions.toLocaleString()} | Clicks: ${s.clicks.toLocaleString()} | CTR: ${ctr}%`,
                    `    Alcance: ${s.reach.toLocaleString()} | Días con datos: ${s.entries}`,
                );
            });
        }
    }

    // Daily data for granular queries
    if (dailySalesData && dailySalesData.length > 0) {
        lines.push('', '--- DATOS DIARIOS (para preguntas sobre "ayer", "hoy", fechas específicas) ---');
        lines.push('Fecha | Órdenes | Ventas ($) | Gasto Ads ($) | Utilidad Proy ($)');
        dailySalesData.forEach((day: any) => {
            const date = day.date || day.name || '';
            const orders = day.orders || 0;
            const sales = day.sales || day.revenue || 0;
            const ads = day.ads || day.spend || 0;
            const profit = day.profit || day.projected_profit || 0;
            lines.push(`${date} | ${orders} | $${Math.round(sales).toLocaleString()} | $${Math.round(ads).toLocaleString()} | $${Math.round(profit).toLocaleString()}`);
        });
    }

    // Berry expenses (operational costs)
    if (berryExpenses && berryExpenses.length > 0) {
        lines.push('', '--- GASTOS OPERATIVOS BERRY (COSTOS FIJOS) ---');
        berryExpenses.forEach(e => {
            lines.push(`  ${e.category}: $${e.amount.toLocaleString()}`);
        });
        lines.push(`  **TOTAL GASTOS OPERATIVOS**: $${(berryExpenseTotal || 0).toLocaleString()}`);
        if (kpis && kpis.u_real !== 0) {
            const utilidadDespuesGastos = kpis.u_real - (berryExpenseTotal || 0);
            lines.push(`  Utilidad después de gastos operativos: $${utilidadDespuesGastos.toLocaleString()}`);
            lines.push(`  Break-even: ${utilidadDespuesGastos >= 0 ? 'ALCANZADO ✓' : 'NO ALCANZADO ✗ — la operación no cubre costos fijos'}`);
        }
    }

    // Campaign names for reference
    if (campaignNames && campaignNames.length > 0) {
        lines.push('', '--- CAMPAÑAS PUBLICITARIAS ACTIVAS ---');
        campaignNames.slice(0, 30).forEach(name => {
            lines.push(`  - ${name}`);
        });
        if (campaignNames.length > 30) {
            lines.push(`  ... y ${campaignNames.length - 30} campañas más`);
        }
    }

    lines.push(
        '',
        `Países activos: ${countries.join(', ')}`,
        `Total pedidos en sistema: ${orderCount}`,
    );

    return lines.join('\n');
}
