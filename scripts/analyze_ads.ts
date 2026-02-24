import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// Read service account from standard location
const serviceAccount = JSON.parse(fs.readFileSync('/Users/tabo/Grand Line with antigravitu/grand-line-v8/.gemini/keys/grand-line-v8-firebase-adminsdk-r9ksv-d9d3d3d3d3.json', 'utf8'));

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function analyzeSpends() {
    console.log('Fetching all marketing_history entries...');
    const snapshot = await db.collection('marketing_history').get();
    console.log(`Found ${snapshot.size} entries.`);

    const stats: Record<string, { count: number, total: number, sources: Set<string>, creators: Set<string>, ids: string[] }> = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Key: date_country_platform_campaign (old style key)
        const key = `${data.date}_${data.country}_${data.platform}_${data.campaignName || 'global'}`;

        if (!stats[key]) {
            stats[key] = { count: 0, total: 0, sources: new Set(), creators: new Set(), ids: [] };
        }

        stats[key].count++;
        stats[key].total += data.amount;
        stats[key].sources.add(data.source);
        stats[key].creators.add(data.creator || 'admin');
        stats[key].ids.push(doc.id);
    });

    console.log('\n--- Duplicate Analysis (Multiple entries for same campaign/day/country) ---');
    let totalDuplicates = 0;
    Object.entries(stats).forEach(([key, data]) => {
        if (data.count > 1) {
            console.log(`Key: ${key}`);
            console.log(`  Count: ${data.count}`);
            console.log(`  Creators: ${Array.from(data.creators).join(', ')}`);
            console.log(`  Sources: ${Array.from(data.sources).join(', ')}`);
            console.log(`  IDs: ${data.ids.join(', ')}`);
            totalDuplicates += (data.count - 1);
        }
    });

    console.log(`\nTotal duplicate entries found: ${totalDuplicates}`);
}

analyzeSpends().catch(console.error);
