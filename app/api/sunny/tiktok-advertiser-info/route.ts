import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

/**
 * GET /api/sunny/tiktok-advertiser-info?advertiser_id=XXX
 * Returns advertiser info including owner_bc_id
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const advertiserId = req.nextUrl.searchParams.get('advertiser_id');
        if (!advertiserId) return NextResponse.json({ error: 'advertiser_id required' }, { status: 400 });

        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });
        const settings = decryptSettings(settingsSnap.data()?.value || {});
        const token = settings.tt_token;
        if (!token) return NextResponse.json({ error: 'No TikTok token' }, { status: 400 });

        const idsParam = encodeURIComponent(JSON.stringify([advertiserId]));
        const fieldsParam = encodeURIComponent(JSON.stringify(["advertiser_id", "name", "owner_bc_id"]));
        const res = await fetch(
            `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=${idsParam}&fields=${fieldsParam}`,
            { headers: { 'Access-Token': token } }
        );
        const data = await res.json();

        if (data.code === 0 && data.data?.list?.length) {
            const adv = data.data.list[0];
            return NextResponse.json({
                advertiser_id: adv.advertiser_id,
                name: adv.name,
                bc_id: adv.owner_bc_id || null,
            });
        }

        return NextResponse.json({ bc_id: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
