/**
 * Migrate Notion pages with full content to Grand Line Docs (Firestore)
 * Usage: node scripts/migrate-notion.mjs
 */
import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ─── Firebase Admin Init ───
const envContent = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
}

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = getFirestore();
const adminAuth = getAuth();

const NOTION_KEY = process.env.NOTION_KEY || '';

// ─── Notion API helpers ───
async function notionFetch(path, body = null) {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Authorization': `Bearer ${NOTION_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res.json();
}

async function getAllPages() {
    let all = [];
    let cursor = undefined;
    while (true) {
        const data = await notionFetch('/search', { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
        all.push(...(data.results || []));
        if (!data.has_more) break;
        cursor = data.next_cursor;
    }
    return all;
}

async function getPageBlocks(pageId) {
    try {
        const data = await notionFetch(`/blocks/${pageId}/children?page_size=100`);
        return data.results || [];
    } catch {
        return [];
    }
}

// ─── Convert Notion blocks to TipTap JSON ───
function richTextToTiptap(richTexts) {
    if (!richTexts || !richTexts.length) return [];
    return richTexts.map(rt => {
        const marks = [];
        if (rt.annotations?.bold) marks.push({ type: 'bold' });
        if (rt.annotations?.italic) marks.push({ type: 'italic' });
        if (rt.annotations?.underline) marks.push({ type: 'underline' });
        if (rt.annotations?.strikethrough) marks.push({ type: 'strike' });
        if (rt.annotations?.code) marks.push({ type: 'code' });
        if (rt.href) marks.push({ type: 'link', attrs: { href: rt.href, target: '_blank' } });

        return {
            type: 'text',
            text: rt.plain_text || '',
            ...(marks.length ? { marks } : {}),
        };
    });
}

function blockToTiptap(block) {
    const type = block.type;

    if (type === 'paragraph') {
        const content = richTextToTiptap(block.paragraph?.rich_text);
        return { type: 'paragraph', ...(content.length ? { content } : {}) };
    }

    if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
        const level = parseInt(type.slice(-1));
        const content = richTextToTiptap(block[type]?.rich_text);
        return { type: 'heading', attrs: { level }, ...(content.length ? { content } : {}) };
    }

    if (type === 'bulleted_list_item') {
        const content = richTextToTiptap(block.bulleted_list_item?.rich_text);
        return {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', ...(content.length ? { content } : {}) }] }],
        };
    }

    if (type === 'numbered_list_item') {
        const content = richTextToTiptap(block.numbered_list_item?.rich_text);
        return {
            type: 'orderedList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph', ...(content.length ? { content } : {}) }] }],
        };
    }

    if (type === 'to_do') {
        const content = richTextToTiptap(block.to_do?.rich_text);
        return {
            type: 'taskList',
            content: [{
                type: 'taskItem',
                attrs: { checked: block.to_do?.checked || false },
                content: [{ type: 'paragraph', ...(content.length ? { content } : {}) }],
            }],
        };
    }

    if (type === 'quote') {
        const content = richTextToTiptap(block.quote?.rich_text);
        return { type: 'blockquote', content: [{ type: 'paragraph', ...(content.length ? { content } : {}) }] };
    }

    if (type === 'code') {
        const text = block.code?.rich_text?.map(rt => rt.plain_text).join('') || '';
        return { type: 'codeBlock', content: [{ type: 'text', text }] };
    }

    if (type === 'divider') {
        return { type: 'horizontalRule' };
    }

    if (type === 'bookmark' || type === 'link_preview') {
        const url = block[type]?.url || '';
        return {
            type: 'paragraph',
            content: [{ type: 'text', text: `🔗 ${url}`, marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }] }],
        };
    }

    if (type === 'image') {
        const url = block.image?.file?.url || block.image?.external?.url || '';
        const caption = block.image?.caption?.map(c => c.plain_text).join('') || '';
        return {
            type: 'paragraph',
            content: [{ type: 'text', text: `📷 ${caption || 'Imagen'}: ${url}` }],
        };
    }

    if (type === 'callout') {
        const icon = block.callout?.icon?.emoji || '💡';
        const content = richTextToTiptap(block.callout?.rich_text);
        const textContent = content.length ? content : [{ type: 'text', text: '' }];
        // Prepend icon
        if (textContent[0]?.text) textContent[0].text = `${icon} ${textContent[0].text}`;
        return { type: 'paragraph', content: textContent };
    }

    // Fallback: try to extract any text
    if (block[type]?.rich_text?.length) {
        const content = richTextToTiptap(block[type].rich_text);
        return { type: 'paragraph', ...(content.length ? { content } : {}) };
    }

    return null;
}

// ─── Filter: skip Notion template/demo pages ───
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

function isDemo(title) {
    return DEMO_KEYWORDS.some(k => title.includes(k));
}

// ─── Main migration ───
async function migrate() {
    const email = process.argv[2] || 'ceo@taboecom.com';
    const firebaseUser = await adminAuth.getUserByEmail(email);
    const TARGET_UID = firebaseUser.uid;
    console.log(`\nUser: ${email} → UID: ${TARGET_UID}`);

    // Fetch all Notion pages
    console.log('Fetching Notion pages...');
    const allItems = await getAllPages();
    console.log(`Found ${allItems.length} items in Notion`);

    // Build lookup
    const lookup = {};
    for (const item of allItems) {
        const objType = item.object;
        let title = '';
        if (objType === 'page') {
            for (const [, propVal] of Object.entries(item.properties || {})) {
                if (propVal.type === 'title' && propVal.title?.length) {
                    title = propVal.title[0].plain_text || '';
                    break;
                }
            }
        } else if (objType === 'database') {
            title = item.title?.[0]?.plain_text || '';
        }

        if (!title || isDemo(title) || item.in_trash) continue;

        const icon = item.icon?.type === 'emoji' ? item.icon.emoji : '';
        const parentType = item.parent?.type;
        let parentId = null;
        if (parentType === 'page_id') parentId = item.parent.page_id;
        else if (parentType === 'database_id') parentId = item.parent.database_id;

        lookup[item.id] = { title, icon, parentId, type: objType, notionId: item.id };
    }

    const validIds = new Set(Object.keys(lookup));
    console.log(`Filtered to ${validIds.size} real pages (excluding demos/templates)`);

    // Fetch content for each page (only pages, not databases)
    let orderCounter = 0;
    const notionToFirestoreId = {};
    const batch = db.batch();
    let count = 0;

    for (const [notionId, info] of Object.entries(lookup)) {
        // Map parent
        let firestoreParentId = null;
        if (info.parentId && validIds.has(info.parentId)) {
            firestoreParentId = notionToFirestoreId[info.parentId] || null;
        }

        const docId = `notion_${notionId.replace(/-/g, '').slice(0, 12)}`;
        notionToFirestoreId[notionId] = docId;

        // Fetch blocks for pages
        let tiptapContent = null;
        if (info.type === 'page') {
            const blocks = await getPageBlocks(notionId);
            if (blocks.length > 0) {
                const tiptapBlocks = blocks.map(blockToTiptap).filter(Boolean);
                if (tiptapBlocks.length > 0) {
                    tiptapContent = { type: 'doc', content: tiptapBlocks };
                }
            }
        }

        const docData = {
            title: info.title,
            icon: info.icon || '',
            parent_id: firestoreParentId,
            team_id: TARGET_UID,
            content: tiptapContent,
            created_by: TARGET_UID,
            created_at: Date.now(),
            updated_at: Date.now(),
            order_index: orderCounter++,
        };

        batch.set(db.collection('docs').doc(docId), docData);
        count++;

        const hasContent = tiptapContent ? '✓' : '○';
        const depth = firestoreParentId ? '  ' : '';
        console.log(`  ${hasContent} ${depth}${info.icon} ${info.title}`);

        // Firestore batch limit is 500
        if (count % 450 === 0) {
            await batch.commit();
            console.log(`  ... committed ${count} docs`);
        }
    }

    await batch.commit();
    console.log(`\n✅ Migrated ${count} pages from Notion to Grand Line Docs.`);
}

migrate().catch(console.error);
