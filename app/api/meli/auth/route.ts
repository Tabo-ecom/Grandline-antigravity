import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const appId = process.env.MELI_APP_ID || '';
    const redirectUri = process.env.MELI_REDIRECT_URI || '';

    if (!appId || !redirectUri) {
        return NextResponse.json({ error: 'MeLi no configurado' }, { status: 500 });
    }

    const authUrl = `https://auth.mercadolibre.com.co/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return NextResponse.redirect(authUrl);
}
