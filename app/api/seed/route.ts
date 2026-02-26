import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── DEMO ACCOUNT CONFIG ───────────────────────────────────────────────────
const DEMO_EMAIL = 'demo@grandline.app';
const DEMO_PASSWORD = 'demo2026!';
const DEMO_DISPLAY_NAME = 'Demo Grand Line';

// ─── FAKE PRODUCT CATALOG ──────────────────────────────────────────────────
const PRODUCTS = [
    { id: 'prod_001', name: 'Proteína Whey Gold', country: 'Colombia', supplierPrice: 45000, salePrice: 149900, shippingCost: 12000 },
    { id: 'prod_002', name: 'Creatina Monohidrato', country: 'Colombia', supplierPrice: 28000, salePrice: 89900, shippingCost: 10000 },
    { id: 'prod_003', name: 'BCAA Ultra Recovery', country: 'Colombia', supplierPrice: 32000, salePrice: 119900, shippingCost: 11000 },
    { id: 'prod_004', name: 'Colágeno Hidrolizado', country: 'Ecuador', supplierPrice: 15, salePrice: 45, shippingCost: 5 },
    { id: 'prod_005', name: 'Vitamina D3 + K2', country: 'Ecuador', supplierPrice: 12, salePrice: 38, shippingCost: 4 },
    { id: 'prod_006', name: 'Omega 3 Premium', country: 'Guatemala', supplierPrice: 95, salePrice: 299, shippingCost: 35 },
    { id: 'prod_007', name: 'Pack Fitness Starter', country: 'Colombia', supplierPrice: 65000, salePrice: 199900, shippingCost: 15000 },
    { id: 'prod_008', name: 'Glutamina L-Glutamine', country: 'Panamá', supplierPrice: 18, salePrice: 55, shippingCost: 6 },
    { id: 'prod_009', name: 'Pre-Workout Explosive', country: 'Colombia', supplierPrice: 38000, salePrice: 129900, shippingCost: 12000 },
    { id: 'prod_010', name: 'Quemador Thermo Burn', country: 'Colombia', supplierPrice: 35000, salePrice: 109900, shippingCost: 11000 },
];

const COUNTRIES = ['Colombia', 'Ecuador', 'Guatemala', 'Panamá'];
const CITIES: Record<string, string[]> = {
    'Colombia': ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales'],
    'Ecuador': ['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Manta'],
    'Guatemala': ['Guatemala City', 'Mixco', 'Villa Nueva', 'Quetzaltenango'],
    'Panamá': ['Panamá City', 'David', 'Colón', 'Santiago'],
};
const CARRIERS: Record<string, string[]> = {
    'Colombia': ['Servientrega', 'Coordinadora', 'Inter Rapidísimo', 'TCC'],
    'Ecuador': ['Servientrega EC', 'Tramaco', 'Urbano Express'],
    'Guatemala': ['Guatex', 'Cargo Expreso', 'DHL Guatemala'],
    'Panamá': ['MBE Panamá', 'Uno Express', 'FedEx Panamá'],
};
const STATUSES = ['ENTREGADO', 'CANCELADO', 'TRÁNSITO', 'DEVOLUCIÓN'];
const STATUS_WEIGHTS = [0.55, 0.25, 0.15, 0.05]; // Probability for each status

const CAMPAIGN_TEMPLATES = [
    { template: '[COUNTRY] - Conversiones - [PRODUCT] - Feb26', platform: 'facebook' as const },
    { template: '[COUNTRY] - Tráfico - [PRODUCT] - Broad', platform: 'facebook' as const },
    { template: '[COUNTRY] - Retargeting - [PRODUCT]', platform: 'facebook' as const },
    { template: '[COUNTRY] - CBO - [PRODUCT] - Lookalike', platform: 'tiktok' as const },
    { template: '[COUNTRY] - Spark Ads - [PRODUCT]', platform: 'tiktok' as const },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice<T>(arr: T[], weights: number[]): T {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) {
        r -= weights[i];
        if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
}

function dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
}

function getDaysInRange(startDate: Date, endDate: Date): string[] {
    const days: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
        days.push(dateStr(current));
        current.setDate(current.getDate() + 1);
    }
    return days;
}

// ─── ORDER GENERATION ──────────────────────────────────────────────────────

function generateOrders(days: string[]): Record<string, any[]> {
    const ordersByCountry: Record<string, any[]> = {};

    for (const day of days) {
        // More orders on weekdays, fewer on weekends
        const date = new Date(day + 'T12:00:00Z');
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const baseOrders = isWeekend ? randomInt(8, 20) : randomInt(15, 45);

        for (let i = 0; i < baseOrders; i++) {
            const product = randomChoice(PRODUCTS);
            const country = product.country;
            const status = weightedChoice(STATUSES, STATUS_WEIGHTS);
            const qty = Math.random() < 0.8 ? 1 : randomInt(2, 3);
            const totalOrder = product.salePrice * qty;
            const supplierTotal = product.supplierPrice * qty;
            const shipping = product.shippingCost;
            const commission = Math.round(totalOrder * 0.05);
            const ganancia = totalOrder - supplierTotal - shipping - commission;
            const returnShipping = status === 'DEVOLUCIÓN' ? Math.round(shipping * 0.7) : 0;

            const city = randomChoice(CITIES[country] || ['Ciudad']);
            const carrier = randomChoice(CARRIERS[country] || ['Transportadora']);

            const order = {
                ID: `DEMO-${day.replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
                ESTATUS: status,
                'TOTAL DE LA ORDEN': totalOrder,
                PRODUCTO: product.name,
                PRODUCTO_ID: product.id,
                SKU: `SKU-${product.id.replace('prod_', '')}`,
                CANTIDAD: qty,
                'PRECIO PROVEEDOR': product.supplierPrice,
                'PRECIO PROVEEDOR X CANTIDAD': supplierTotal,
                'PRECIO FLETE': shipping,
                'COSTO DEVOLUCION FLETE': returnShipping,
                GANANCIA: ganancia,
                FECHA: day,
                CIUDAD: city,
                'CIUDAD DESTINO': city,
                COMISION: commission,
                PAIS: country,
                TRANSPORTADORA: carrier,
                RECAUDO: status === 'ENTREGADO' ? 'RECAUDADO' : 'PENDIENTE',
            };

            if (!ordersByCountry[country]) ordersByCountry[country] = [];
            ordersByCountry[country].push(order);
        }
    }

    return ordersByCountry;
}

// ─── AD SPEND GENERATION ──────────────────────────────────────────────────

interface AdEntry {
    id: string;
    amount: number;
    currency: string;
    source: 'api';
    platform: 'facebook' | 'tiktok';
    updatedAt: number;
    productId: string;
    date: string;
    country: string;
    campaignName: string;
    creator: string;
    userId: string;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    leads: number;
    conversions: number;
    reach: number;
    timestamp: FieldValue;
}

function generateAdSpend(days: string[], userId: string): { entries: AdEntry[], mappings: any[] } {
    const entries: AdEntry[] = [];
    const mappingsMap = new Map<string, any>();

    for (const product of PRODUCTS) {
        // Each product gets 1-3 campaigns
        const numCampaigns = randomInt(1, 3);
        const templates = [...CAMPAIGN_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, numCampaigns);

        for (const tpl of templates) {
            const campaignName = tpl.template
                .replace('[COUNTRY]', product.country)
                .replace('[PRODUCT]', product.name);

            // Save mapping
            if (!mappingsMap.has(campaignName)) {
                mappingsMap.set(campaignName, {
                    campaignName,
                    productId: product.id,
                    productName: product.name,
                    platform: tpl.platform,
                    country: product.country,
                    updatedAt: Date.now(),
                });
            }

            // Generate daily spend for this campaign
            for (const day of days) {
                // Some campaigns don't run every day
                if (Math.random() < 0.15) continue;

                const isCOP = product.country === 'Colombia';
                const baseSpend = isCOP ? randomInt(15000, 85000) : randomInt(5, 35);
                const currency = isCOP ? 'COP' : 'USD';

                const impressions = randomInt(500, 5000);
                const clicks = randomInt(10, Math.floor(impressions * 0.08));
                const ctr = parseFloat(((clicks / impressions) * 100).toFixed(2));
                const cpc = parseFloat((baseSpend / clicks).toFixed(2));
                const leads = randomInt(1, Math.max(1, Math.floor(clicks * 0.15)));
                const conversions = randomInt(0, Math.max(1, Math.floor(leads * 0.5)));
                const reach = randomInt(impressions, impressions * 3);

                const sanitizedCampaign = campaignName.replace(/\W/g, '');
                const deterministicId = `${userId}_${day}_${tpl.platform}_${sanitizedCampaign}`;

                entries.push({
                    id: deterministicId,
                    amount: baseSpend,
                    currency,
                    source: 'api',
                    platform: tpl.platform,
                    updatedAt: Date.now(),
                    productId: product.id,
                    date: day,
                    country: product.country,
                    campaignName,
                    creator: 'admin',
                    userId,
                    impressions,
                    clicks,
                    ctr,
                    cpc,
                    leads,
                    conversions,
                    reach,
                    timestamp: FieldValue.serverTimestamp(),
                });
            }
        }
    }

    return { entries, mappings: Array.from(mappingsMap.values()) };
}

// ─── EXPENSE GENERATION ───────────────────────────────────────────────────

function generateExpenses(): any[] {
    const categories = [
        { category: 'Aplicaciones', items: ['Shopify', 'Dropi', 'Klaviyo', 'Canva Pro'] },
        { category: 'Fullfilment', items: ['Bodega Bogotá', 'Empaque'] },
        { category: 'Envíos', items: ['Servientrega Masivo', 'Coordinadora'] },
        { category: 'Nómina', items: ['Community Manager', 'Diseñador', 'Atención al Cliente'] },
        { category: 'Servicios', items: ['Internet', 'Teléfono', 'Hosting'] },
        { category: 'Gastos Bancarios', items: ['Comisión Bancolombia', 'Pasarela de Pago'] },
        { category: 'Impuestos', items: ['IVA', 'Retención'] },
    ];

    const expenses: any[] = [];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    for (const cat of categories) {
        for (const item of cat.items) {
            const amount = randomInt(50000, 2500000);
            expenses.push({
                id: `exp_demo_${cat.category.replace(/\s/g, '')}_${item.replace(/\s/g, '')}_${month}`,
                category: cat.category,
                subcategory: item,
                amount,
                currency: 'COP',
                date: `${year}-${String(month).padStart(2, '0')}-01`,
                month,
                year,
                notes: 'Dato de ejemplo',
                recurring: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
    }

    return expenses;
}

// ─── MAIN SEED HANDLER ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        if (!adminAuth || !adminDb) {
            return NextResponse.json({ error: 'Firebase Admin no configurado' }, { status: 500 });
        }

        // Auth: require admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const callerDoc = await adminDb.collection('user_profiles').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Solo administradores pueden crear la cuenta demo' }, { status: 403 });
        }

        // ─── Step 1: Create or get demo user ──────────────────────────────
        let demoUid: string;
        try {
            const existing = await adminAuth.getUserByEmail(DEMO_EMAIL);
            demoUid = existing.uid;
        } catch {
            const newUser = await adminAuth.createUser({
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
                displayName: DEMO_DISPLAY_NAME,
            });
            demoUid = newUser.uid;
        }

        // ─── Step 2: Create user profile ──────────────────────────────────
        await adminDb.collection('user_profiles').doc(demoUid).set({
            user_id: demoUid,
            email: DEMO_EMAIL,
            role: 'admin',
            display_name: DEMO_DISPLAY_NAME,
            team_id: demoUid,
            created_at: new Date(),
            is_demo: true,
        });

        // ─── Step 3: Generate date range (last 30 days) ──────────────────
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const days = getDaysInRange(startDate, endDate);

        // ─── Step 4: Generate & save orders ───────────────────────────────
        const ordersByCountry = generateOrders(days);
        let totalOrders = 0;

        for (const [country, orders] of Object.entries(ordersByCountry)) {
            const docId = `demo_${country.toLowerCase().replace(/\s/g, '_')}_${demoUid}`;

            // Delete existing demo data for this country
            try { await adminDb.collection('order_files').doc(docId).delete(); } catch {}
            try { await adminDb.collection('import_logs').doc(docId).delete(); } catch {}

            await adminDb.collection('order_files').doc(docId).set({
                userId: demoUid,
                fileName: `demo_${country.toLowerCase()}.csv`,
                country,
                orderCount: orders.length,
                orders,
                id: docId,
                uploaded_at: new Date(),
            });

            await adminDb.collection('import_logs').doc(docId).set({
                userId: demoUid,
                fileName: `demo_${country.toLowerCase()}.csv`,
                country,
                orderCount: orders.length,
                uploaded_at: new Date(),
            });

            totalOrders += orders.length;
        }

        // ─── Step 5: Generate & save ad spend ────────────────────────────
        const { entries: adEntries, mappings } = generateAdSpend(days, demoUid);

        // Write in batches of 450
        const BATCH_SIZE = 450;
        for (let i = 0; i < adEntries.length; i += BATCH_SIZE) {
            const chunk = adEntries.slice(i, i + BATCH_SIZE);
            const batch = adminDb.batch();
            for (const entry of chunk) {
                const ref = adminDb.collection('marketing_history').doc(entry.id);
                batch.set(ref, entry, { merge: true });
            }
            await batch.commit();
        }

        // ─── Step 6: Save product groups ─────────────────────────────────
        const productGroups = [
            {
                id: 'grp_proteinas',
                name: 'Proteínas',
                productIds: ['prod_001', 'prod_007'],
                country: 'Colombia',
                color: '#8b5cf6',
                updatedAt: Date.now(),
            },
            {
                id: 'grp_suplementos',
                name: 'Suplementos Deportivos',
                productIds: ['prod_002', 'prod_003', 'prod_009'],
                country: 'Colombia',
                color: '#06b6d4',
                updatedAt: Date.now(),
            },
            {
                id: 'grp_salud',
                name: 'Salud & Bienestar',
                productIds: ['prod_004', 'prod_005', 'prod_006'],
                color: '#10b981',
                updatedAt: Date.now(),
            },
            {
                id: 'grp_quemadores',
                name: 'Quemadores',
                productIds: ['prod_010'],
                country: 'Colombia',
                color: '#ef4444',
                updatedAt: Date.now(),
            },
        ];

        // ─── Step 7: Save all app_data documents ─────────────────────────
        const setAppData = async (key: string, value: any) => {
            await adminDb!.collection('app_data').doc(`${key}_${demoUid}`).set({
                key,
                value,
                userId: demoUid,
                updated_at: new Date(),
            });
        };

        // Campaign mappings
        await setAppData('campaign_mappings', mappings);

        // Product groups
        await setAppData('product_groups', productGroups);

        // Ad settings (empty tokens — demo doesn't connect real APIs)
        await setAppData('ad_settings', {
            fb_token: '',
            fb_account_ids: [],
            tt_token: '',
            tt_account_ids: [],
            fb_currency: 'COP',
            tt_currency: 'USD',
            ai_provider: 'none',
            ai_api_key: '',
            ai_auto_map: false,
            google_api_key: '',
            google_client_id: '',
            custom_metrics: [],
        });

        // KPI targets (defaults)
        await setAppData('kpi_targets', {
            targets: [
                { key: 'roas_real', label: 'ROAS Real', unit: 'x', good: 2, warning: 1.5, inverse: false, description: 'Retorno sobre inversión publicitaria.' },
                { key: 'cpa', label: 'CPA', unit: '$', good: 25000, warning: 30000, inverse: true, description: 'Costo por adquisición.' },
                { key: 'tasa_ent', label: 'Tasa de Entrega', unit: '%', good: 65, warning: 50, inverse: false, description: 'Porcentaje de órdenes entregadas.' },
                { key: 'tasa_can', label: 'Tasa de Cancelación', unit: '%', good: 30, warning: 40, inverse: true, description: 'Porcentaje de órdenes canceladas.' },
                { key: 'margen_neto', label: 'Margen Neto', unit: '%', good: 15, warning: 5, inverse: false, description: 'Porcentaje de utilidad sobre ingreso.' },
                { key: 'perc_ads_revenue', label: '% Ads vs Revenue', unit: '%', good: 25, warning: 35, inverse: true, description: 'Proporción del gasto publicitario sobre facturación.' },
                { key: 'tasa_dev', label: 'Tasa de Devolución', unit: '%', good: 10, warning: 20, inverse: true, description: 'Porcentaje de órdenes devueltas.' },
            ],
            updatedAt: Date.now(),
        });

        // Projection settings
        await setAppData('projection_settings', {
            deliveryRate: 60,
            returnRate: 8,
            avgOrderValue: 130000,
            avgSupplierCost: 40000,
            avgShippingCost: 12000,
            avgCommission: 5,
            monthlyFixedCosts: 3000000,
            updatedAt: Date.now(),
        });

        // Berry expenses
        const expenses = generateExpenses();
        await setAppData('berry_expenses', expenses);

        // Berry categories
        await setAppData('berry_categories', [
            'Aplicaciones', 'Fullfilment', 'Envíos', 'Nómina',
            'Servicios', 'Gastos Bancarios', 'Otros Gastos',
            'Inversiones', 'Impuestos', 'Marketing', 'Pendiente',
        ]);

        // Vega alert rules (sample)
        await setAppData('vega_alert_rules', [
            {
                id: 'alert_demo_cancel',
                name: 'Cancelación Alta',
                metric: 'tasa_can',
                condition: 'above',
                threshold: 35,
                frequency: 'daily',
                channels: ['dashboard'],
                enabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: 'alert_demo_roas',
                name: 'ROAS Bajo',
                metric: 'roas_real',
                condition: 'below',
                threshold: 1.5,
                frequency: 'daily',
                channels: ['dashboard'],
                enabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ]);

        // Vega triggered alerts, reports, notification config (empty)
        await setAppData('vega_triggered_alerts', []);
        await setAppData('vega_reports', []);
        await setAppData('vega_notification_config', {
            telegramBotToken: '',
            telegramChatId: '',
            slackWebhookUrl: '',
        });

        // AI suggestions (empty)
        await setAppData('ai_suggestions', []);

        // Price corrections (empty)
        await setAppData('price_corrections', []);

        return NextResponse.json({
            success: true,
            demo: {
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
                uid: demoUid,
                stats: {
                    orders: totalOrders,
                    countries: Object.keys(ordersByCountry),
                    adEntries: adEntries.length,
                    campaigns: mappings.length,
                    productGroups: productGroups.length,
                    expenses: expenses.length,
                },
            },
        });
    } catch (error: any) {
        console.error('Error seeding demo account:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

// ─── DELETE DEMO DATA ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
    try {
        if (!adminAuth || !adminDb) {
            return NextResponse.json({ error: 'Firebase Admin no configurado' }, { status: 500 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);
        const callerDoc = await adminDb.collection('user_profiles').doc(decoded.uid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
        }

        // Find demo user
        let demoUid: string;
        try {
            const existing = await adminAuth.getUserByEmail(DEMO_EMAIL);
            demoUid = existing.uid;
        } catch {
            return NextResponse.json({ error: 'No existe cuenta demo' }, { status: 404 });
        }

        // Delete marketing_history
        const adSnap = await adminDb.collection('marketing_history').where('userId', '==', demoUid).get();
        const BATCH_SIZE = 450;
        for (let i = 0; i < adSnap.docs.length; i += BATCH_SIZE) {
            const batch = adminDb.batch();
            adSnap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
            await batch.commit();
        }

        // Delete order_files and import_logs
        const orderSnap = await adminDb.collection('order_files').where('userId', '==', demoUid).get();
        for (const d of orderSnap.docs) {
            await d.ref.delete();
            try { await adminDb.collection('import_logs').doc(d.id).delete(); } catch {}
        }

        // Delete all app_data docs for this user
        const appDataSnap = await adminDb.collection('app_data').where('userId', '==', demoUid).get();
        for (const d of appDataSnap.docs) {
            await d.ref.delete();
        }

        // Delete profile
        await adminDb.collection('user_profiles').doc(demoUid).delete();

        // Delete auth user
        await adminAuth.deleteUser(demoUid);

        return NextResponse.json({ success: true, deleted: demoUid });
    } catch (error: any) {
        console.error('Error deleting demo account:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
