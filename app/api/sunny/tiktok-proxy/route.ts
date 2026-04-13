import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { decrypt } from '@/lib/api/crypto';

/**
 * POST /api/sunny/tiktok-proxy
 *
 * Server-side proxy for TikTok Content Posting API.
 * Handles video upload (init + publish as draft).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

        const { action, ...params } = await req.json();

        // Get TikTok OAuth token
        const docRef = adminDb.collection('app_data').doc(`tiktok_oauth_${auth.teamId}`);
        const snap = await docRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: 'TikTok no conectado' }, { status: 400 });
        }

        const oauthData = snap.data()!;
        const accessToken = decrypt(oauthData.access_token);

        // Check token expiry
        if (oauthData.expires_at && Date.now() > oauthData.expires_at) {
            // Try refresh
            const refreshed = await refreshTikTokToken(oauthData, auth.teamId);
            if (!refreshed) {
                return NextResponse.json({ error: 'Token expirado, reconecta TikTok' }, { status: 401 });
            }
            return handleAction(action, params, refreshed, oauthData.open_id);
        }

        return handleAction(action, params, accessToken, oauthData.open_id);
    } catch (error) {
        console.error('TikTok proxy error:', error);
        return NextResponse.json({ error: 'Error en proxy TikTok' }, { status: 500 });
    }
}

async function handleAction(action: string, params: any, accessToken: string, openId: string) {
    switch (action) {
        case 'init_video_upload':
            return initVideoUpload(accessToken, params);
        case 'publish_video':
            return publishVideo(accessToken, params, openId);
        case 'check_publish_status':
            return checkPublishStatus(accessToken, params);
        default:
            return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
}

/**
 * Step 1: Initialize video upload — get upload URL from TikTok
 */
async function initVideoUpload(accessToken: string, params: { fileSize: number; chunkSize?: number }) {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
            source_info: {
                source: 'FILE_UPLOAD',
                video_size: params.fileSize,
                chunk_size: params.chunkSize || params.fileSize,
                total_chunk_count: 1,
            },
        }),
    });

    const data = await res.json();

    if (data.error?.code !== 'ok' && data.error?.code) {
        return NextResponse.json({ error: data.error?.message || 'Init upload failed', details: data }, { status: 400 });
    }

    return NextResponse.json({
        upload_url: data.data?.upload_url,
        publish_id: data.data?.publish_id,
    });
}

/**
 * Step 2: Publish video as draft (creator posts from TikTok)
 */
async function publishVideo(accessToken: string, params: { publishId: string; title?: string }, openId: string) {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
            publish_id: params.publishId,
        }),
    });

    const data = await res.json();
    return NextResponse.json(data);
}

/**
 * Check publish status
 */
async function checkPublishStatus(accessToken: string, params: { publishId: string }) {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
            publish_id: params.publishId,
        }),
    });

    const data = await res.json();
    return NextResponse.json(data);
}

/**
 * Refresh TikTok access token using refresh token
 */
async function refreshTikTokToken(oauthData: any, userId: string): Promise<string | null> {
    const refreshToken = decrypt(oauthData.refresh_token);
    if (!refreshToken) return null;

    try {
        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key: process.env.TIKTOK_CLIENT_KEY || '',
                client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        const data = await res.json();
        if (data.error || !data.access_token) return null;

        // Update stored tokens
        const { encrypt: enc } = await import('@/lib/api/crypto');
        const docRef = adminDb!.collection('app_data').doc(`tiktok_oauth_${userId}`);
        await docRef.update({
            access_token: enc(data.access_token),
            refresh_token: data.refresh_token ? enc(data.refresh_token) : oauthData.refresh_token,
            expires_at: Date.now() + (data.expires_in * 1000),
            updated_at: new Date(),
        });

        return data.access_token;
    } catch {
        return null;
    }
}
