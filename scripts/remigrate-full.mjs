import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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

const enriched = JSON.parse(readFileSync('/tmp/clickup_enriched.json', 'utf-8'));

function mapStatus(s) {
    s = (s || '').toLowerCase();
    if (s.includes('completado') || s.includes('complete')) return 'completado';
    if (s.includes('progreso')) return 'en_progreso';
    if (s.includes('aprobación') || s.includes('aprobacion')) return 'pendiente_aprobacion';
    if (s.includes('corregir')) return 'corregir';
    if (s.includes('bloqueado')) return 'bloqueado';
    if (s.includes('retraso')) return 'retraso';
    if (s.includes('listo')) return 'listo_para_subir';
    if (s.includes('testeo')) return 'testeo_programado';
    if (s.includes('guionizado') || s.includes('editado') || s.includes('grabado')) return 'pendiente_aprobacion';
    if (s.includes('cotizar')) return 'pendiente';
    if (s.includes('nuevo')) return 'pendiente';
    // Analisis statuses
    if (s.includes('corriendo')) return 'corriendo';
    if (s.includes('escalando')) return 'escalando';
    if (s.includes('apagado')) return 'apagado';
    if (s.includes('revision') || s.includes('revisión')) return 'revision';
    if (s.includes('sin asignar')) return 'sin_asignar';
    return 'pendiente';
}

async function run() {
    const user = await adminAuth.getUserByEmail('ceo@taboecom.com');
    const UID = user.uid;
    console.log(`UID: ${UID}\n`);

    // Get or create spaces
    const spacesSnap = await db.collection('task_spaces').where('team_id', '==', UID).get();
    let spaces = spacesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (spaces.length === 0) {
        console.log('Creating spaces...');
        const defaults = [
            { name: 'TABO accesorios', icon: '🎧', color: '#3b82f6', type: 'public', order_index: 0 },
            { name: 'Lucent', icon: '✨', color: '#8b5cf6', type: 'public', order_index: 1 },
            { name: 'Dropshipping', icon: '🦋', color: '#06b6d4', type: 'public', order_index: 2 },
            { name: 'Creadores UGC', icon: '🎬', color: '#ec4899', type: 'private', order_index: 3 },
            { name: 'GUSTAVO', icon: '🟢', color: '#22c55e', type: 'public', order_index: 4 },
        ];
        const batch = db.batch();
        for (const def of defaults) {
            const id = `space_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const space = { ...def, id, team_id: UID, members: [] };
            batch.set(db.collection('task_spaces').doc(id), space);
            spaces.push(space);
            await new Promise(r => setTimeout(r, 15));
        }
        await batch.commit();
    }

    const spaceMap = {};
    for (const s of spaces) {
        const lower = s.name.toLowerCase();
        if (lower.includes('tabo')) spaceMap['tabo'] = s.id;
        if (lower.includes('lucent')) spaceMap['lucent'] = s.id;
        if (lower.includes('drop')) spaceMap['drop'] = s.id;
        if (lower.includes('ugc')) spaceMap['ugc'] = s.id;
        if (lower.includes('gustavo')) spaceMap['gustavo'] = s.id;
    }

    console.log('Spaces:', Object.entries(spaceMap).map(([k,v]) => `${k}=${v}`).join(', '));

    // Delete all existing space_tasks (except GUSTAVO tasks)
    const existingSnap = await db.collection('space_tasks').where('team_id', '==', UID).get();
    let deleted = 0;
    let batch = db.batch();
    let bc = 0;
    for (const d of existingSnap.docs) {
        const data = d.data();
        if (data.space_id === spaceMap['gustavo']) continue; // keep GUSTAVO
        batch.delete(d.ref);
        deleted++;
        bc++;
        if (bc >= 450) { await batch.commit(); batch = db.batch(); bc = 0; }
    }
    if (bc > 0) await batch.commit();
    console.log(`Deleted ${deleted} old tasks (kept GUSTAVO)\n`);

    // Migrate enriched tasks (skip GUSTAVO space tasks)
    let migrated = 0;
    batch = db.batch();
    bc = 0;

    for (const t of enriched) {
        // Determine space
        const cuSpace = (t.space || '').toLowerCase();
        const cuList = (t.list || '').toLowerCase();
        const cuFolder = (t.folder || '').toLowerCase();

        let spaceId;
        if (cuSpace.includes('tabo acce') || cuSpace.includes('tabo acc')) {
            spaceId = spaceMap['tabo'];
        } else if (cuSpace.includes('lucent')) {
            spaceId = spaceMap['lucent'];
        } else if (cuSpace.includes('drop')) {
            spaceId = spaceMap['drop'];
        } else if (cuSpace.includes('ugc') || cuSpace.includes('creadores')) {
            spaceId = spaceMap['ugc'];
        } else if (cuSpace.includes('gustavo')) {
            // Skip GUSTAVO - already exists or we don't touch it
            continue;
        } else {
            // Unknown - try by tienda
            const tienda = (t.tienda || '').toLowerCase();
            if (tienda.includes('tabo')) spaceId = spaceMap['tabo'];
            else if (tienda.includes('lucent')) spaceId = spaceMap['lucent'];
            else if (tienda.includes('drop')) spaceId = spaceMap['drop'];
            else continue; // skip if we can't determine
        }

        if (!spaceId) continue;

        // List type
        let listType = 'asignaciones';
        if (cuFolder.includes('analisis') || cuList.includes('analisis')) {
            listType = 'analisis';
        }

        // Status
        let status = mapStatus(t.status);
        if (listType === 'analisis' && ['pendiente', 'en_progreso', 'pendiente_aprobacion'].includes(status)) {
            if (status === 'pendiente') status = 'sin_asignar';
            else if (status === 'en_progreso') status = 'corriendo';
            else if (status === 'pendiente_aprobacion') status = 'revision';
        }

        // Files
        const files = (t.attachments || []).map(att => ({
            id: `file_${att.id || Date.now()}`,
            name: att.title || att.filename || 'Archivo',
            url: att.url || '',
            uploaded_by: (att.creator || {}).username || 'ClickUp',
            size: att.size ? `${Math.round(att.size / 1024)}KB` : '',
            timestamp: parseInt(att.date) || Date.now(),
        }));

        // Comments
        const comments = (t.comments || []).map(cmt => {
            const text = (cmt.comment || []).map(c => c.text || '').join('');
            return text.trim() ? {
                id: `cmt_${cmt.id || Date.now()}`,
                author: (cmt.user || {}).username || 'ClickUp',
                text,
                timestamp: parseInt(cmt.date) || Date.now(),
            } : null;
        }).filter(Boolean);

        // Priority mapping
        let priority = 'normal';
        const p = (t.priority || '').toLowerCase();
        if (p === 'urgent') priority = 'urgente';
        else if (p === 'high') priority = 'alta';
        else if (p === 'low') priority = 'baja';

        const newTask = {
            id: `cu_${t.id}`,
            name: t.name,
            description: t.description || '',
            space_id: spaceId,
            list_type: listType,
            status,
            assignees: t.assignees || [],
            priority,
            due_date: t.due_date ? parseInt(t.due_date) : null,
            tienda: t.tienda || '',
            producto: t.producto || '',
            codigo_dropi: '',
            tipo_actividad: t.tipo_actividad || '',
            tipo_estrategia: '',
            link_drive: t.link_drive || '',
            url_pagina: t.url || '',
            cuenta_publicitaria: t.cuenta_publicitaria || '',
            rendimiento: (t.rendimiento || '').toLowerCase(),
            resultados: t.resultados || '',
            punto_dolor: t.punto_dolor || '',
            nota: '',
            progress: status === 'completado' ? 100 : 0,
            created_by: UID,
            created_at: parseInt(t.date_created) || Date.now(),
            updated_at: parseInt(t.date_updated) || Date.now(),
            team_id: UID,
            subtasks: [],
            comments,
            files,
            activity: [{
                id: `act_import_${t.id}`,
                actor: 'Sistema',
                text: `Importado de ClickUp — ${t.space} / ${t.folder || t.list}${t.tags.length ? ` [${t.tags.join(', ')}]` : ''}`,
                timestamp: Date.now(),
            }],
        };

        batch.set(db.collection('space_tasks').doc(newTask.id), newTask);
        migrated++;
        bc++;

        const spaceName = spaces.find(s => s.id === spaceId)?.name || '?';
        const extras = [t.tienda, t.producto, t.tipo_actividad].filter(Boolean).join(' | ');
        console.log(`  ✓ [${spaceName}/${listType}] ${t.name.slice(0,40).padEnd(40)} ${extras}`);

        if (bc >= 450) { await batch.commit(); batch = db.batch(); bc = 0; }
    }

    if (bc > 0) await batch.commit();

    // Summary
    const finalSnap = await db.collection('space_tasks').where('team_id', '==', UID).get();
    const bySpace = {};
    for (const s of spaces) bySpace[s.id] = { name: s.name, total: 0, asig: 0, anal: 0 };
    finalSnap.docs.forEach(d => {
        const data = d.data();
        if (bySpace[data.space_id]) {
            bySpace[data.space_id].total++;
            if (data.list_type === 'analisis') bySpace[data.space_id].anal++;
            else bySpace[data.space_id].asig++;
        }
    });

    console.log(`\n✅ Migrated ${migrated} tasks.`);
    console.log('\nDistribution:');
    for (const [, info] of Object.entries(bySpace)) {
        if (info.total > 0) console.log(`  ${info.name}: ${info.asig} asig + ${info.anal} analisis = ${info.total}`);
    }
}

run().catch(console.error);
