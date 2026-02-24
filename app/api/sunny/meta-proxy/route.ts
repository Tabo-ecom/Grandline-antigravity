import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

export const maxDuration = 300; // 5 minutes max for video uploads

// Allowed Meta Graph API endpoint patterns
const ALLOWED_ENDPOINT_PATTERNS = [
    /^\/v\d+\.\d+\/act_\d+/,              // Ad account operations (campaigns, adsets, ads, advideos, etc.)
    /^\/v\d+\.\d+\/\d+/,                   // Object-by-ID operations (campaign/123, adset/123, etc.)
    /^\/v\d+\.\d+\/search/,                // Location/interest search
    /^\/v\d+\.\d+\/me\/adaccounts/,        // List user ad accounts
];

function isAllowedEndpoint(endpoint: string): boolean {
    return ALLOWED_ENDPOINT_PATTERNS.some(pattern => pattern.test(endpoint));
}

/**
 * Unified Meta API proxy — forwards requests to Meta Graph API server-side
 * to avoid CORS issues (especially for file uploads and search).
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) return unauthorizedResponse();

        const endpoint = request.nextUrl.searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json(
                { error: { message: 'Missing endpoint query parameter' } },
                { status: 400 }
            );
        }

        if (!isAllowedEndpoint(endpoint)) {
            return NextResponse.json(
                { error: { message: 'Endpoint not allowed' } },
                { status: 403 }
            );
        }

        // Forward all query params except "endpoint" to Meta
        const metaParams = new URLSearchParams();
        request.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 'endpoint') metaParams.set(key, value);
        });

        const url = `https://graph.facebook.com${endpoint}?${metaParams.toString()}`;
        const metaResponse = await fetch(url);

        const responseText = await metaResponse.text();
        return new NextResponse(responseText, {
            status: metaResponse.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[Meta Proxy GET] Error:', error);
        return NextResponse.json(
            { error: { message: error.message || 'Internal proxy error' } },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) return unauthorizedResponse();

        const endpoint = request.nextUrl.searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json(
                { error: { message: 'Missing endpoint query parameter' } },
                { status: 400 }
            );
        }

        if (!isAllowedEndpoint(endpoint)) {
            return NextResponse.json(
                { error: { message: 'Endpoint not allowed' } },
                { status: 403 }
            );
        }

        const url = `https://graph.facebook.com${endpoint}`;
        const contentType = request.headers.get('content-type') || '';

        // Read raw body bytes and forward to Meta with same Content-Type
        const bodyBuffer = await request.arrayBuffer();

        const metaResponse = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': contentType },
            body: bodyBuffer,
        });

        // Forward Meta's response as-is
        const responseText = await metaResponse.text();
        return new NextResponse(responseText, {
            status: metaResponse.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[Meta Proxy] Error:', error);
        return NextResponse.json(
            { error: { message: error.message || 'Internal proxy error' } },
            { status: 500 }
        );
    }
}
