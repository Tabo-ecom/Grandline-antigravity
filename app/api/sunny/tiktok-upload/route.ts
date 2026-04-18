import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decryptSettings } from '@/lib/api/crypto';

export const maxDuration = 60;

const TT_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * POST /api/sunny/tiktok-upload
 * Server-side proxy for uploading video/image creatives to TikTok Ads.
 * Receives FormData with: advertiser_id, file, type (video|image)
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        // Get TikTok token from settings
        const settingsSnap = await adminDb.collection('app_data').doc(`ad_settings_${auth.teamId}`).get();
        if (!settingsSnap.exists) return NextResponse.json({ error: 'No settings' }, { status: 400 });
        const settings = decryptSettings(settingsSnap.data()?.value || {});
        const token = settings.tt_token;
        if (!token) return NextResponse.json({ error: 'No TikTok token' }, { status: 400 });

        const formData = await req.formData();
        const advertiserId = formData.get('advertiser_id') as string;
        const file = formData.get('file') as File;
        const fileType = formData.get('type') as string; // 'video' or 'image'

        if (!advertiserId || !file) {
            return NextResponse.json({ error: 'advertiser_id and file required' }, { status: 400 });
        }

        // Build FormData for TikTok API
        const ttForm = new FormData();
        ttForm.append('advertiser_id', advertiserId);
        ttForm.append('upload_type', 'UPLOAD_BY_FILE');

        if (fileType === 'video') {
            ttForm.append('video_file', file);
        } else {
            ttForm.append('image_file', file);
        }

        const endpoint = fileType === 'video'
            ? `${TT_API_BASE}/file/video/ad/upload/`
            : `${TT_API_BASE}/file/image/ad/upload/`;

        const ttRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Access-Token': token },
            body: ttForm,
        });

        const ttText = await ttRes.text();
        let ttData: any;
        try {
            ttData = JSON.parse(ttText);
        } catch {
            return NextResponse.json({
                error: 'TikTok returned invalid response',
                raw: ttText.substring(0, 300),
                status: ttRes.status,
            }, { status: 400 });
        }

        if (ttData.code !== 0) {
            return NextResponse.json({
                error: ttData.message || 'Upload failed',
                tt_code: ttData.code,
            }, { status: 400 });
        }

        const resultId = fileType === 'video'
            ? ttData.data?.video_id
            : ttData.data?.image_id;

        return NextResponse.json({
            success: true,
            id: resultId,
            type: fileType,
        });
    } catch (error: any) {
        console.error('[TikTok Upload] error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
