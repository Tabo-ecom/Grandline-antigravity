/**
 * Send test emails for ALL 7 VEGA report types
 * Usage: node scripts/test-all-reports.mjs
 */
import { readFileSync } from 'fs';
import { createTransport } from 'nodemailer';

// Parse .env.local
const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/);
    if (m) env[m[1]] = m[2];
}

const transporter = createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT), secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

const TO = 'ceo@taboecom.com';
const FROM = env.SMTP_FROM || env.SMTP_USER;

// ── Report definitions ──
const reports = [
    {
        type: 'daily',
        title: 'El Latido del Negocio',
        label: 'REPORTE DIARIO',
        color: '#d75c33',
        period: '17 Abril 2026',
        summary: 'Día estable con 52 órdenes procesadas. ROAS real de 2.3x con CPA despachado de $28,500. La tasa de entrega cerró en 64.8%, ligeramente por encima del promedio.',
        kpis: [
            { label: 'Órdenes', value: '52', color: '#60a5fa' },
            { label: 'Ingreso Real', value: '$3.2M', color: '#10b981' },
            { label: 'ROAS Real', value: '2.3x', color: '#f59e0b' },
            { label: 'Utilidad Proy.', value: '$1.8M', color: '#10b981' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">🟢 Top Productos</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Audífonos Bluetooth Pro</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:900;">$480K</td><td style="padding:8px;text-align:right;color:#10b981;">32.1%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Sérum Vitamina C</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:900;">$320K</td><td style="padding:8px;text-align:right;color:#10b981;">28.5%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Organizador Cocina</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:900;">$185K</td><td style="padding:8px;text-align:right;color:#10b981;">25.8%</td></tr>
                </table>
            </div>
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">💡 Recomendaciones</h3>
                <div style="padding:12px;background:#10b98115;border-left:3px solid #10b981;border-radius:8px;margin-bottom:8px;">
                    <span style="color:#10b981;font-weight:700;font-size:11px;">[ESCALAR]</span>
                    <p style="color:#ccc;font-size:13px;margin:4px 0 0;">Audífonos Bluetooth Pro tiene ROAS 3.8x. Incrementar presupuesto 25%.</p>
                </div>
                <div style="padding:12px;background:#f59e0b15;border-left:3px solid #f59e0b;border-radius:8px;">
                    <span style="color:#f59e0b;font-weight:700;font-size:11px;">[MONITOREAR]</span>
                    <p style="color:#ccc;font-size:13px;margin:4px 0 0;">CPA de Masajeador subió 18% vs ayer. Vigilar próximas 24h.</p>
                </div>
            </div>`,
    },
    {
        type: 'weekly',
        title: 'La Brújula Táctica',
        label: 'REPORTE SEMANAL',
        color: '#d75c33',
        period: '11 - 17 Abril 2026',
        summary: 'Semana con crecimiento del 12% en órdenes vs semana anterior. ROAS mejoró de 1.9x a 2.3x gracias a optimización de campañas en Colombia.',
        kpis: [
            { label: 'Órdenes Semana', value: '342', color: '#60a5fa' },
            { label: 'Ingreso Real', value: '$18.5M', color: '#10b981' },
            { label: 'Utilidad Real', value: '$5.2M', color: '#10b981' },
            { label: 'vs Semana Ant.', value: '+12%', color: '#10b981' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">📊 Tendencia Semanal</h3>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr style="border-bottom:1px solid #333;color:#666;"><td style="padding:6px;">Métrica</td><td style="padding:6px;text-align:right;">Sem. Ant.</td><td style="padding:6px;text-align:right;">Esta Sem.</td><td style="padding:6px;text-align:right;">Cambio</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Órdenes</td><td style="padding:8px;text-align:right;color:#888;">305</td><td style="padding:8px;text-align:right;color:#fff;font-weight:700;">342</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">+12.1%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">ROAS</td><td style="padding:8px;text-align:right;color:#888;">1.9x</td><td style="padding:8px;text-align:right;color:#fff;font-weight:700;">2.3x</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">+21.1%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Tasa Entrega</td><td style="padding:8px;text-align:right;color:#888;">61.2%</td><td style="padding:8px;text-align:right;color:#fff;font-weight:700;">64.8%</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">+3.6pp</td></tr>
                </table>
            </div>`,
    },
    {
        type: 'logistics',
        title: 'Bitácora Logística',
        label: 'BITÁCORA LOGÍSTICA',
        color: '#3b82f6',
        period: '17 Abril 2026',
        summary: 'Tasa de entrega del 64.8% con 18 cancelaciones. Servientrega lidera con 71% de entrega. 3 devoluciones por "No desea el producto".',
        kpis: [
            { label: '% Entrega', value: '64.8%', color: '#10b981' },
            { label: 'Cancelaciones', value: '18', color: '#ef4444' },
            { label: 'Devoluciones', value: '3', color: '#f97316' },
            { label: 'En Tránsito', value: '127', color: '#f59e0b' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">🚫 Motivos de Cancelación</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #333;color:#666;font-size:11px;"><td style="padding:6px;">MOTIVO</td><td style="padding:6px;text-align:right;">CANT.</td><td style="padding:6px;text-align:right;">%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">No contesta / Fuera de cobertura</td><td style="padding:8px;text-align:right;color:#ef4444;font-weight:700;">7</td><td style="padding:8px;text-align:right;color:#ef4444;">38.9%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Cliente cancela</td><td style="padding:8px;text-align:right;color:#ef4444;font-weight:700;">5</td><td style="padding:8px;text-align:right;color:#ef4444;">27.8%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Dirección incorrecta</td><td style="padding:8px;text-align:right;color:#f59e0b;font-weight:700;">3</td><td style="padding:8px;text-align:right;color:#f59e0b;">16.7%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">No desea el producto</td><td style="padding:8px;text-align:right;color:#f59e0b;font-weight:700;">3</td><td style="padding:8px;text-align:right;color:#f59e0b;">16.7%</td></tr>
                </table>
            </div>
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">🚚 Por Transportadora</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #333;color:#666;font-size:11px;"><td style="padding:6px;">TRANSPORTADORA</td><td style="padding:6px;text-align:right;">ÓRDENES</td><td style="padding:6px;text-align:right;">ENTREGADAS</td><td style="padding:6px;text-align:right;">% ENTREGA</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Servientrega</td><td style="padding:8px;text-align:right;color:#fff;">28</td><td style="padding:8px;text-align:right;color:#10b981;">20</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">71.4%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Coordinadora</td><td style="padding:8px;text-align:right;color:#fff;">15</td><td style="padding:8px;text-align:right;color:#f59e0b;">9</td><td style="padding:8px;text-align:right;color:#f59e0b;font-weight:700;">60.0%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Inter Rapidísimo</td><td style="padding:8px;text-align:right;color:#fff;">9</td><td style="padding:8px;text-align:right;color:#ef4444;">4</td><td style="padding:8px;text-align:right;color:#ef4444;font-weight:700;">44.4%</td></tr>
                </table>
            </div>`,
    },
    {
        type: 'financial',
        title: 'Estado de Resultados',
        label: 'ESTADO DE RESULTADOS',
        color: '#10b981',
        period: '11 - 17 Abril 2026',
        summary: 'Utilidad neta de $2.8M con margen del 15.1%. Los gastos operativos representan el 22% de los ingresos. Publicidad es el mayor costo variable.',
        kpis: [
            { label: 'Ingresos', value: '$18.5M', color: '#10b981' },
            { label: 'Gan. Bruta', value: '$8.2M', color: '#60a5fa' },
            { label: 'Util. Neta', value: '$2.8M', color: '#10b981' },
            { label: 'Margen Neto', value: '15.1%', color: '#10b981' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">📊 Estado de Resultados</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #333;color:#666;font-size:11px;"><td style="padding:6px;">CONCEPTO</td><td style="padding:6px;text-align:right;">MONTO</td><td style="padding:6px;text-align:right;">% ING.</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#888;padding-left:20px;">Ing. Proveedor</td><td style="padding:8px;text-align:right;color:#10b981;">$5.4M</td><td style="padding:8px;text-align:right;color:#888;">29.2%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#888;padding-left:20px;">Ing. Dropshipping</td><td style="padding:8px;text-align:right;color:#10b981;">$13.1M</td><td style="padding:8px;text-align:right;color:#888;">70.8%</td></tr>
                    <tr style="background:#10b98110;border-bottom:1px solid #222;"><td style="padding:10px;color:#fff;font-weight:900;">INGRESOS TOTALES</td><td style="padding:10px;text-align:right;color:#10b981;font-weight:900;">$18.5M</td><td style="padding:10px;text-align:right;color:#10b981;font-weight:700;">100%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ef4444;padding-left:20px;">(-) Costos Producto</td><td style="padding:8px;text-align:right;color:#ef4444;">$10.3M</td><td style="padding:8px;text-align:right;color:#888;">55.7%</td></tr>
                    <tr style="background:#60a5fa10;border-bottom:1px solid #222;"><td style="padding:10px;color:#60a5fa;font-weight:900;">= GANANCIA BRUTA</td><td style="padding:10px;text-align:right;color:#60a5fa;font-weight:900;">$8.2M</td><td style="padding:10px;text-align:right;color:#60a5fa;font-weight:700;">44.3%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#f97316;padding-left:20px;">(-) Fletes (Ventas)</td><td style="padding:8px;text-align:right;color:#f97316;">$2.1M</td><td style="padding:8px;text-align:right;color:#888;">11.4%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#a855f7;padding-left:20px;">(-) Publicidad</td><td style="padding:8px;text-align:right;color:#a855f7;">$1.5M</td><td style="padding:8px;text-align:right;color:#888;">8.1%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ef4444;padding-left:20px;">(-) Gastos Operativos</td><td style="padding:8px;text-align:right;color:#ef4444;">$1.2M</td><td style="padding:8px;text-align:right;color:#888;">6.5%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ef4444;padding-left:20px;">(-) Gastos Admin.</td><td style="padding:8px;text-align:right;color:#ef4444;">$600K</td><td style="padding:8px;text-align:right;color:#888;">3.2%</td></tr>
                    <tr style="background:#10b98115;"><td style="padding:12px;color:#fff;font-weight:900;font-size:14px;">= UTILIDAD NETA</td><td style="padding:12px;text-align:right;color:#10b981;font-weight:900;font-size:14px;">$2.8M</td><td style="padding:12px;text-align:right;color:#10b981;font-weight:900;">15.1%</td></tr>
                </table>
            </div>`,
    },
    {
        type: 'supplier',
        title: 'Reporte Proveedor',
        label: 'REPORTE PROVEEDOR',
        color: '#8b5cf6',
        period: '11 - 17 Abril 2026',
        summary: 'Ingreso proveedor de $5.4M con margen del 38.2%. Sin fletes aplicados. Audífonos Bluetooth lidera con 42% de margen. 2 productos con stock bajo.',
        kpis: [
            { label: 'Ingreso Prov.', value: '$5.4M', color: '#10b981' },
            { label: 'Ganancia', value: '$2.1M', color: '#10b981' },
            { label: 'Margen', value: '38.2%', color: '#8b5cf6' },
            { label: 'Stock Alerts', value: '2', color: '#f59e0b' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">📦 Top Productos por Margen</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #333;color:#666;font-size:11px;"><td style="padding:6px;">PRODUCTO</td><td style="padding:6px;text-align:right;">UNIDADES</td><td style="padding:6px;text-align:right;">GANANCIA</td><td style="padding:6px;text-align:right;">MARGEN</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Audífonos Bluetooth Pro</td><td style="padding:8px;text-align:right;color:#fff;">85</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">$890K</td><td style="padding:8px;text-align:right;color:#10b981;">42.1%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Sérum Vitamina C</td><td style="padding:8px;text-align:right;color:#fff;">62</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">$520K</td><td style="padding:8px;text-align:right;color:#10b981;">38.5%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Organizador Cocina</td><td style="padding:8px;text-align:right;color:#fff;">41</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">$310K</td><td style="padding:8px;text-align:right;color:#10b981;">35.2%</td></tr>
                </table>
            </div>
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">⚠️ Alertas de Inventario</h3>
                <div style="padding:12px;background:#f59e0b15;border-left:3px solid #f59e0b;border-radius:8px;margin-bottom:8px;">
                    <p style="color:#f59e0b;font-size:13px;margin:0;"><strong>Sérum Vitamina C</strong>: 12 unidades restantes (~4 días)</p>
                </div>
                <div style="padding:12px;background:#ef444415;border-left:3px solid #ef4444;border-radius:8px;">
                    <p style="color:#ef4444;font-size:13px;margin:0;"><strong>Cable USB-C 3m</strong>: 3 unidades restantes (~1 día)</p>
                </div>
            </div>`,
    },
    {
        type: 'month_close',
        title: 'Cierre de Mes',
        label: 'CIERRE DE MES',
        color: '#f59e0b',
        period: 'Marzo 2026',
        summary: 'Mes cerrado con utilidad neta de $12.4M y margen del 16.8%. Crecimiento del 8% vs febrero. Colombia lidera con 72% de los ingresos.',
        kpis: [
            { label: 'Ingresos Mes', value: '$73.8M', color: '#10b981' },
            { label: 'Util. Neta', value: '$12.4M', color: '#10b981' },
            { label: 'Margen Neto', value: '16.8%', color: '#f59e0b' },
            { label: 'vs Feb.', value: '+8.2%', color: '#10b981' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">📊 Estado de Resultados — Marzo 2026</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="background:#10b98110;border-bottom:1px solid #222;"><td style="padding:10px;color:#fff;font-weight:900;">INGRESOS TOTALES</td><td style="padding:10px;text-align:right;color:#10b981;font-weight:900;">$73.8M</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ef4444;padding-left:20px;">(-) Costos</td><td style="padding:8px;text-align:right;color:#ef4444;">$41.2M</td></tr>
                    <tr style="background:#60a5fa10;border-bottom:1px solid #222;"><td style="padding:10px;color:#60a5fa;font-weight:900;">= GANANCIA BRUTA</td><td style="padding:10px;text-align:right;color:#60a5fa;font-weight:900;">$32.6M</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#f97316;padding-left:20px;">(-) Fletes + Ads + Gastos</td><td style="padding:8px;text-align:right;color:#f97316;">$20.2M</td></tr>
                    <tr style="background:#10b98118;"><td style="padding:12px;color:#fff;font-weight:900;font-size:14px;">= UTILIDAD NETA</td><td style="padding:12px;text-align:right;color:#10b981;font-weight:900;font-size:14px;">$12.4M</td></tr>
                </table>
            </div>
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">📈 vs Febrero 2026</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Ingresos</td><td style="padding:8px;text-align:right;color:#888;">$68.2M</td><td style="padding:8px;text-align:right;color:#fff;font-weight:700;">$73.8M</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">+8.2%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Utilidad Neta</td><td style="padding:8px;text-align:right;color:#888;">$10.8M</td><td style="padding:8px;text-align:right;color:#fff;font-weight:700;">$12.4M</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">+14.8%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">Margen</td><td style="padding:8px;text-align:right;color:#888;">15.8%</td><td style="padding:8px;text-align:right;color:#fff;font-weight:700;">16.8%</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">+1.0pp</td></tr>
                </table>
            </div>`,
    },
    {
        type: 'monthly',
        title: 'La Visión del Almirante',
        label: 'REPORTE MENSUAL',
        color: '#f59e0b',
        period: '1 - 17 Abril 2026',
        summary: 'A mitad de abril proyectamos cerrar con $82M en ingresos y $14.2M en utilidad neta. Guatemala muestra crecimiento acelerado del 25%.',
        kpis: [
            { label: 'Ingresos MTD', value: '$38.5M', color: '#10b981' },
            { label: 'Proy. Mes', value: '$82M', color: '#f59e0b' },
            { label: 'Util. Proy.', value: '$14.2M', color: '#10b981' },
            { label: 'Países', value: '3', color: '#60a5fa' },
        ],
        sections: `
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">🌎 Por País</h3>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <tr style="border-bottom:1px solid #333;color:#666;font-size:11px;"><td style="padding:6px;">PAÍS</td><td style="padding:6px;text-align:right;">INGRESOS</td><td style="padding:6px;text-align:right;">UTILIDAD</td><td style="padding:6px;text-align:right;">MARGEN</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">🇨🇴 Colombia</td><td style="padding:8px;text-align:right;color:#fff;">$27.5M</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">$4.8M</td><td style="padding:8px;text-align:right;color:#10b981;">17.5%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">🇬🇹 Guatemala</td><td style="padding:8px;text-align:right;color:#fff;">$8.2M</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:700;">$1.5M</td><td style="padding:8px;text-align:right;color:#10b981;">18.3%</td></tr>
                    <tr style="border-bottom:1px solid #222;"><td style="padding:8px;color:#ccc;">🇪🇨 Ecuador</td><td style="padding:8px;text-align:right;color:#fff;">$2.8M</td><td style="padding:8px;text-align:right;color:#f59e0b;font-weight:700;">$280K</td><td style="padding:8px;text-align:right;color:#f59e0b;">10.0%</td></tr>
                </table>
            </div>
            <div style="margin-bottom:24px;">
                <h3 style="color:ACCENT;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">🔮 Proyecciones</h3>
                <div style="padding:12px;background:#10b98115;border-left:3px solid #10b981;border-radius:8px;margin-bottom:8px;">
                    <p style="color:#10b981;font-size:13px;margin:0;">Al ritmo actual, abril cierra con <strong>$82M</strong> en ingresos (+11% vs marzo)</p>
                </div>
                <div style="padding:12px;background:#60a5fa15;border-left:3px solid #60a5fa;border-radius:8px;">
                    <p style="color:#60a5fa;font-size:13px;margin:0;">Guatemala crece 25% MoM. Considerar incrementar presupuesto de ads 30%.</p>
                </div>
            </div>`,
    },
];

// ── Email HTML builder ──
function buildEmail(r) {
    const ac = r.color;
    return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Space Grotesk',Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,${ac}22,#141821);border:1px solid ${ac}33;border-radius:20px;padding:32px;text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:${ac}20;border:1px solid ${ac}44;border-radius:8px;padding:4px 16px;margin-bottom:12px;">
            <span style="color:${ac};font-size:10px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">${r.label}</span>
        </div>
        <h1 style="color:#ffffff;font-size:24px;margin:8px 0 4px;font-weight:900;">${r.title}</h1>
        <p style="color:#666;font-size:13px;margin:0;">${r.period}</p>
    </div>

    <!-- Executive Summary -->
    <div style="background:#141821;border:1px solid #1e2330;border-left:3px solid ${ac};border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#ccc;font-size:14px;line-height:1.7;margin:0;">${r.summary}</p>
    </div>

    <!-- KPI Cards -->
    <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${r.kpis.map(k => `
        <div style="flex:1;background:#141821;border:1px solid #1e2330;border-radius:12px;padding:16px;text-align:center;">
            <p style="color:#666;font-size:9px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;font-weight:900;">${k.label}</p>
            <p style="color:${k.color};font-size:20px;font-weight:900;margin:0;font-family:monospace;">${k.value}</p>
        </div>`).join('')}
    </div>

    <!-- Dynamic Sections -->
    <div style="background:#141821;border:1px solid #1e2330;border-radius:16px;padding:24px;margin-bottom:24px;">
        ${r.sections.replace(/ACCENT/g, ac)}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #1e2330;">
        <p style="color:${ac};font-size:11px;font-weight:900;letter-spacing:2px;margin:0 0 4px;">⚡ VEGA AI</p>
        <p style="color:#444;font-size:10px;margin:0;">Grand Line v8 • vega@grandline.com.co</p>
    </div>
</div>
</body></html>`;
}

// ── Send all reports ──
console.log(`Enviando ${reports.length} reportes de prueba a ${TO}...\n`);

for (const r of reports) {
    try {
        const html = buildEmail(r);
        const info = await transporter.sendMail({
            from: FROM,
            to: TO,
            subject: `⚡ VEGA — ${r.title} (${r.period})`,
            html,
        });
        console.log(`✅ ${r.label} (${r.type}) → ${info.messageId}`);
    } catch (err) {
        console.error(`❌ ${r.label}: ${err.message}`);
    }
    // Small delay between sends
    await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log('\n🎉 Todos los reportes enviados. Revisa tu bandeja.');
