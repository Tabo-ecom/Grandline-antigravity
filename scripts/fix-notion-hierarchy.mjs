import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const envContent = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
}
if (!getApps().length) {
    initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
}
const db = getFirestore();
const adminAuth = getAuth();

// Re-fetch Notion structure to get proper parent-child relationships
const NOTION_KEY = process.env.NOTION_KEY || '';

async function notionFetch(path, body = null) {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Authorization': `Bearer ${NOTION_KEY}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res.json();
}

const DEMO_KEYWORDS = ['Equipo A', 'Equipo B', 'Equipo X', 'Equipo Y', 'Primeros pasos',
    'Asignación de personal', 'Interview Question', 'Ejemplo de',
    'Introducción a', 'Nueva standup', 'Nueva reunión', 'Nuevo brainstorming',
    'Editor de documentos', 'Inserciones', 'Invitar a nuevos', 'Compartir en redes',
    'Investigación de usuario', 'Nueva página', 'Charla sobre experiencia',
    'Afinadores de piano', 'Diseño de nueva', 'Ajustes del usuario',
    'Permisos de documentos', 'Ejemplo de subpágina', 'Standup del equipo',
    'Reunión semanal del equipo', 'Cómo usar la verificación', 'Cómo lanzar',
    'Ciclo de vida', 'Estadísticas y herramientas', 'Directorio de producto',
    'Entrevistas', 'Especificaciones técnicas', 'Especificaciones de producto'];

async function run() {
    const user = await adminAuth.getUserByEmail('ceo@taboecom.com');
    const UID = user.uid;

    // Get all Notion items
    let allItems = [];
    let cursor = undefined;
    while (true) {
        const data = await notionFetch('/search', { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
        allItems.push(...(data.results || []));
        if (!data.has_more) break;
        cursor = data.next_cursor;
    }

    // Build Notion ID → title + parent mapping
    const notionLookup = {};
    for (const item of allItems) {
        let title = '';
        if (item.object === 'page') {
            for (const [, pv] of Object.entries(item.properties || {})) {
                if (pv.type === 'title' && pv.title?.length) { title = pv.title[0].plain_text; break; }
            }
        } else if (item.object === 'database') {
            title = item.title?.[0]?.plain_text || '';
        }
        if (!title || DEMO_KEYWORDS.some(k => title.includes(k)) || item.in_trash) continue;

        const parentType = item.parent?.type;
        let notionParentId = null;
        if (parentType === 'page_id') notionParentId = item.parent.page_id;
        else if (parentType === 'database_id') notionParentId = item.parent.database_id;

        notionLookup[item.id] = { title, notionParentId };
    }

    // Get all docs from Firestore
    const snap = await db.collection('docs').where('team_id', '==', UID).get();
    const docs = [];
    snap.forEach(d => docs.push({ firestoreId: d.id, ...d.data() }));

    // Build mapping: notion ID (from firestore doc ID) → firestore doc ID
    // Our doc IDs are like notion_XXXXXXXXXXXX (first 12 chars of notion ID without dashes)
    const notionIdToFirestoreId = {};
    const firestoreIdToNotionId = {};
    
    for (const doc of docs) {
        if (doc.firestoreId.startsWith('notion_')) {
            const shortId = doc.firestoreId.replace('notion_', '');
            // Find matching notion ID
            for (const notionId of Object.keys(notionLookup)) {
                const clean = notionId.replace(/-/g, '').slice(0, 12);
                if (clean === shortId) {
                    notionIdToFirestoreId[notionId] = doc.firestoreId;
                    firestoreIdToNotionId[doc.firestoreId] = notionId;
                    break;
                }
            }
        }
    }

    // Now fix parent_id for each doc
    let fixed = 0;
    const batch = db.batch();
    
    for (const doc of docs) {
        const notionId = firestoreIdToNotionId[doc.firestoreId];
        if (!notionId) continue;

        const notionInfo = notionLookup[notionId];
        if (!notionInfo) continue;

        let correctParentId = null;
        if (notionInfo.notionParentId && notionIdToFirestoreId[notionInfo.notionParentId]) {
            correctParentId = notionIdToFirestoreId[notionInfo.notionParentId];
        }

        // Only update if different
        if (doc.parent_id !== correctParentId) {
            batch.update(db.collection('docs').doc(doc.firestoreId), { parent_id: correctParentId });
            fixed++;
            const parentTitle = correctParentId ? docs.find(d => d.firestoreId === correctParentId)?.title : 'ROOT';
            console.log(`  ✓ "${doc.title}" → parent: "${parentTitle}"`);
        }
    }

    if (fixed > 0) {
        await batch.commit();
        console.log(`\n✅ Fixed hierarchy for ${fixed} docs.`);
    } else {
        console.log('All docs already have correct hierarchy.');
    }
}

run().catch(console.error);
