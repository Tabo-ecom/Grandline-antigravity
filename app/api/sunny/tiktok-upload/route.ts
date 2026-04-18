import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

export const maxDuration = 60;

const TT_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * POST /api/sunny/tiktok-upload
 * Server-side proxy for uploading creatives to TikTok via URL.
 * Client uploads file to Firebase Storage first, then passes the URL here.
 * Body: { advertiser_id, type: 'video'|'image', url, fileName? }
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });
        const settings = decryptSettings(settingsSnap.data()?.value || {});
        const token = settings.tt_token;
        if (!token) return NextResponse.json({ error: 'No TikTok token' }, { status: 400 });

        const { advertiser_id, type, url, fileName } = await req.json();

        if (!advertiser_id || !url || !type) {
            return NextResponse.json({ error: 'advertiser_id, type, and url required' }, { status: 400 });
        }

        let endpoint: string;
        let body: any;

        if (type === 'video') {
            endpoint = `${TT_API_BASE}/file/video/ad/upload/`;
            body = {
                advertiser_id,
                upload_type: 'UPLOAD_BY_URL',
                video_url: url,
                file_name: fileName || `video_${Date.now()}.mp4`,
            };
        } else {
            endpoint = `${TT_API_BASE}/file/image/ad/upload/`;
            body = {
                advertiser_id,
                upload_type: 'UPLOAD_BY_URL',
                image_url: url,
            };
        }

        const ttRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Access-Token': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const ttText = await ttRes.text();
        let ttData: any;
        try {
            ttData = JSON.parse(ttText);
        } catch {
            return NextResponse.json({
                error: 'TikTok returned invalid response',
                raw: ttText.substring(0, 300),
            }, { status: 400 });
        }

        if (ttData.code !== 0) {
            return NextResponse.json({
                error: ttData.message || 'Upload failed',
                tt_code: ttData.code,
            }, { status: 400 });
        }

        const resultId = type === 'video'
            ? ttData.data?.video_id
            : ttData.data?.image_id;

        return NextResponse.json({ success: true, id: resultId, type });
    } catch (error: any) {
        console.error('[TikTok Upload] error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
