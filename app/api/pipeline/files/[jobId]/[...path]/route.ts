import { NextRequest, NextResponse } from 'next/server';

const PIPELINE_URL = process.env.PIPELINE_API_URL || '';

// No auth required — jobId acts as a temporary access token
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string; path: string[] }> }) {
    try {
        const { jobId, path } = await params;
        const filePath = path.join('/');
        const res = await fetch(`${PIPELINE_URL}/files/${jobId}/${filePath}`);

        if (!res.ok) {
            return NextResponse.json({ error: 'Archivo no encontrado' }, { status: res.status });
        }

        const contentType = res.headers.get('Content-Type') || 'image/png';
        const buffer = await res.arrayBuffer();
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Content-Disposition': `inline; filename="${path[path.length - 1] || 'file'}"`,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Error descargando archivo' }, { status: 500 });
    }
}
