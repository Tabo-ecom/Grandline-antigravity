import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(_req: NextRequest) {
    if (!adminDb) return NextResponse.json({ error: 'No DB' }, { status: 500 });

    const userId = 'jbNZO8GwmTWw07RiK5DVgbYiGh33';

    // Count TikTok records
    const ttSnap = await adminDb.collection('marketing_history')
        .where('userId', '==', userId)
        .where('platform', '==', 'tiktok')
        .limit(10)
        .get();

    const fbSnap = await adminDb.collection('marketing_history')
        .where('userId', '==', userId)
        .where('platform', '==', 'facebook')
        .limit(5)
        .get();

    const allSnap = await adminDb.collection('marketing_history')
        .where('userId', '==', userId)
        .limit(5)
        .get();

    return NextResponse.json({
        tiktok_count: ttSnap.size,
        tiktok_samples: ttSnap.docs.map(d => ({ id: d.id, name: d.data().campaignName, platform: d.data().platform, date: d.data().date, amount: d.data().amount })),
        facebook_count: fbSnap.size,
        all_count: allSnap.size,
        all_samples: allSnap.docs.map(d => ({ id: d.id, platform: d.data().platform, name: d.data().campaignName })),
    });
}
