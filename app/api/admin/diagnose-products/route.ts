import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
    try {
        if (!adminDb || !adminAuth) {
            return NextResponse.json({ error: 'Not configured' }, { status: 500 });
        }

        // Auth check
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);

        // Get user profile to find effectiveUid
        const profileSnap = await adminDb.collection('user_profiles').doc(decoded.uid).get();
        const profile = profileSnap.data();
        const effectiveUid = profile?.team_id || decoded.uid;

        // 1. Get product groups
        const groupsDoc = await adminDb.collection('app_data').doc(`product_groups_${effectiveUid}`).get();
        const groups = groupsDoc.exists ? groupsDoc.data()?.value || [] : [];

        // 2. Get all order files for this user
        const orderFilesSnap = await adminDb.collection('order_files')
            .where('userId', '==', effectiveUid)
            .get();

        // 3. Extract unique product names and IDs
        const productMap: Record<string, { names: Set<string>, ids: Set<string>, count: number, countries: Set<string> }> = {};

        orderFilesSnap.docs.forEach(doc => {
            const data = doc.data();
            const country = data.country || 'Unknown';
            if (data.orders && Array.isArray(data.orders)) {
                data.orders.forEach((order: any) => {
                    const name = (order.PRODUCTO || '').trim();
                    const id = (order.PRODUCTO_ID?.toString() || '').trim();

                    // Group by name (lowercase) to find variants
                    const key = name.toLowerCase();
                    if (!key) return;

                    if (!productMap[key]) {
                        productMap[key] = { names: new Set(), ids: new Set(), count: 0, countries: new Set() };
                    }
                    productMap[key].names.add(name);
                    if (id) productMap[key].ids.add(id);
                    productMap[key].count++;
                    productMap[key].countries.add(country);
                });
            }
        });

        // Convert sets to arrays for JSON
        const products = Object.entries(productMap)
            .map(([key, val]) => ({
                key,
                names: Array.from(val.names),
                ids: Array.from(val.ids),
                count: val.count,
                countries: Array.from(val.countries),
            }))
            .sort((a, b) => b.count - a.count);

        // 4. Check which products match groups and which don't
        const diagnosis = products.map(p => {
            const matchedGroups: string[] = [];
            const unmatchedIds: string[] = [];
            const unmatchedNames: string[] = [];

            p.ids.forEach(id => {
                const group = groups.find((g: any) =>
                    g.productIds?.some((pid: string) => pid.toLowerCase().trim() === id.toLowerCase().trim())
                );
                if (group) {
                    if (!matchedGroups.includes(group.id)) matchedGroups.push(group.id);
                } else {
                    unmatchedIds.push(id);
                }
            });

            p.names.forEach(name => {
                const group = groups.find((g: any) =>
                    g.productIds?.some((pid: string) => pid.toLowerCase().trim() === name.toLowerCase().trim())
                );
                if (group) {
                    if (!matchedGroups.includes(group.id)) matchedGroups.push(group.id);
                } else {
                    unmatchedNames.push(name);
                }
            });

            return {
                ...p,
                matchedGroups,
                unmatchedIds,
                unmatchedNames,
                status: matchedGroups.length > 0
                    ? (unmatchedIds.length > 0 || unmatchedNames.length > 0 ? 'PARTIAL' : 'OK')
                    : 'NO_GROUP'
            };
        });

        // Filter to show problems
        const problems = diagnosis.filter(d => d.status !== 'OK' && d.matchedGroups.length > 0);
        const searchTerms = ['cinta', 'cicatri', 'mascarilla', 'parche'];
        const relevant = diagnosis.filter(d =>
            searchTerms.some(term => d.key.includes(term) || d.names.some(n => n.toLowerCase().includes(term)))
        );

        return NextResponse.json({
            effectiveUid,
            groupCount: groups.length,
            groups: groups.map((g: any) => ({ id: g.id, name: g.name, productIds: g.productIds })),
            totalProducts: products.length,
            problems,
            relevant,
            allProducts: products.slice(0, 50), // Top 50 by order count
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
