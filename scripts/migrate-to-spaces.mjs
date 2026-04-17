/**
 * Migrate tasks from old vega_tasks format to new space_tasks collection
 * Run AFTER deploying Firestore rules and creating spaces in the UI
 *
 * Usage: node scripts/migrate-to-spaces.mjs
 */
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

async function run() {
    const user = await adminAuth.getUserByEmail('ceo@taboecom.com');
    const UID = user.uid;
    console.log(`UID: ${UID}\n`);

    // 1. Get or create spaces
    const spacesSnap = await db.collection('task_spaces').where('team_id', '==', UID).get();
    let spaces = spacesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (spaces.length === 0) {
        console.log('Creating default spaces...');
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
            await new Promise(r => setTimeout(r, 10)); // ensure unique IDs
        }
        await batch.commit();
        console.log(`Created ${spaces.length} spaces\n`);
    } else {
        console.log(`Found ${spaces.length} existing spaces\n`);
    }

    // Build space lookup
    const spaceByName = {};
    for (const s of spaces) {
        const lower = s.name.toLowerCase();
        spaceByName[lower] = s.id;
        if (lower.includes('tabo')) spaceByName['tabo'] = s.id;
        if (lower.includes('lucent')) spaceByName['lucent'] = s.id;
        if (lower.includes('drop')) spaceByName['dropshipping'] = s.id;
        if (lower.includes('ugc')) spaceByName['ugc'] = s.id;
        if (lower.includes('gustavo')) spaceByName['gustavo'] = s.id;
    }

    // 2. Load old tasks
    const oldDoc = await db.collection('app_data').doc(`vega_tasks_${UID}`).get();
    const oldTasks = oldDoc.exists ? oldDoc.data().value || [] : [];
    console.log(`Old tasks to migrate: ${oldTasks.length}\n`);

    // 3. Check existing space_tasks to avoid duplicates
    const existingSnap = await db.collection('space_tasks').where('team_id', '==', UID).get();
    const existingNames = new Set(existingSnap.docs.map(d => d.data().name));
    console.log(`Existing space_tasks: ${existingSnap.size}\n`);

    // 4. Migrate
    let migrated = 0;
    let skipped = 0;
    let batchCount = 0;
    let batch = db.batch();

    for (const old of oldTasks) {
        if (existingNames.has(old.name)) { skipped++; continue; }

        // Determine space
        let spaceId = spaceByName['gustavo']; // default
        const store = (old.store || '').toLowerCase();
        const tipo = (old.tipoActividad || '').toLowerCase();
        const src = ((old.activity?.[0]?.text || '')).toLowerCase();

        if (store === 'tabo' || src.includes('tabo accesorios') || src.includes('tabo -')) {
            spaceId = spaceByName['tabo'] || spaceId;
        } else if (store === 'lucent' || src.includes('lucent')) {
            spaceId = spaceByName['lucent'] || spaceId;
        } else if (store === 'dropshipping' || src.includes('dropshipping') || src.includes('drop ')) {
            spaceId = spaceByName['dropshipping'] || spaceId;
        }

        // GUSTAVO sub-lists mapping
        if (src.includes('grand line') || tipo === 'desarrollo') {
            spaceId = spaceByName['gustavo'] || spaceId;
        } else if (src.includes('gl group') || tipo === 'gestion') {
            spaceId = spaceByName['gustavo'] || spaceId;
        } else if (src.includes('personal') || tipo === 'personal') {
            spaceId = spaceByName['gustavo'] || spaceId;
        } else if (src.includes('tabo ecom') || tipo === 'contenido') {
            spaceId = spaceByName['gustavo'] || spaceId;
        }

        // Determine list type
        let listType = 'asignaciones';
        if (tipo.includes('analisis')) listType = 'analisis';

        // Map status
        let status = old.status || 'pendiente';
        if (listType === 'analisis') {
            // Map to analisis statuses
            if (status === 'pendiente') status = 'sin_asignar';
            else if (status === 'en_progreso') status = 'corriendo';
            else if (status === 'pendiente_aprobacion') status = 'revision';
            else if (status === 'bloqueado') status = 'revision';
            else if (status === 'completado') status = 'completado';
        }

        // Try to extract custom fields from the full ClickUp data
        let cfTienda = old.store || '';
        let cfProducto = old.product || '';
        let cfTipo = old.tipoActividad || '';
        let cfCuenta = old.cuentaPublicitaria || '';

        // Map store names to proper tienda values
        if (cfTienda === 'tabo') cfTienda = 'TABO ACCESORIOS';
        else if (cfTienda === 'lucent') cfTienda = 'LUCENT';
        else if (cfTienda === 'dropshipping') cfTienda = 'DROP COLOMBIA';

        // Extract producto from task name if empty
        if (!cfProducto) {
            const name = old.name || '';
            const products = ['MAGWALLET', 'ECHOPLUGS', 'SELFIE PANTALLA', 'CINTA CICATRICES', 'CANDY BELLA',
                'CONTORNO OJOS', 'BRASSIER', 'EXFOLIANTE NARANJA', 'PINK STUFF', 'RETINOL', 'SEOUL 1988',
                'MIXSOON', 'SPRAY MAGNESIO', 'SPRAY ARRUGAS', 'PETER TOMAS', 'MELAXIN', 'SUPER BEET',
                'BEETFLOW', 'HAIR GROWTH', 'ASTAXANTHIN', 'CYPERUS'];
            for (const p of products) {
                if (name.toUpperCase().includes(p)) { cfProducto = p; break; }
            }
        }

        // Extract tipo from source if generic
        if (!cfTipo || cfTipo === 'Asignacion Semanal') {
            const name = (old.name || '').toLowerCase();
            if (name.includes('funnel')) cfTipo = 'FUNNEL';
            else if (name.includes('landing')) cfTipo = 'LANDING PAGE';
            else if (name.includes('imagenes') || name.includes('imágenes')) cfTipo = 'IMAGENES PUBLICITARIAS';
            else if (name.includes('creativos') || name.includes('creativo')) cfTipo = 'VIDEOS CREATIVOS';
            else if (name.includes('testeo')) cfTipo = 'CAMPAÑAS';
        }

        const newTask = {
            id: old.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: old.name,
            description: old.description || '',
            space_id: spaceId,
            list_type: listType,
            status,
            assignees: old.assignees || [],
            priority: old.priority || 'normal',
            due_date: old.scheduledFor || null,
            tienda: cfTienda,
            producto: cfProducto,
            codigo_dropi: '',
            tipo_actividad: cfTipo,
            tipo_estrategia: old.tipoEstrategia || '',
            link_drive: old.linkDrive || '',
            url_pagina: old.urlPagina || '',
            cuenta_publicitaria: old.cuentaPublicitaria || '',
            rendimiento: '',
            resultados: '',
            punto_dolor: '',
            nota: '',
            progress: old.progress || 0,
            created_by: UID,
            created_at: old.createdAt || Date.now(),
            updated_at: old.updatedAt || Date.now(),
            team_id: UID,
            subtasks: old.subtasks || [],
            comments: old.comments || [],
            files: old.files || [],
            activity: old.activity || [],
        };

        batch.set(db.collection('space_tasks').doc(newTask.id), newTask);
        migrated++;
        batchCount++;

        const spaceName = spaces.find(s => s.id === spaceId)?.name || '?';
        console.log(`  ✓ [${spaceName}/${listType}] ${old.name.slice(0, 55)}`);

        if (batchCount >= 450) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
            console.log(`  ... committed batch`);
        }
    }

    if (batchCount > 0) await batch.commit();

    console.log(`\n✅ Migrated ${migrated} tasks to space_tasks. Skipped ${skipped} duplicates.`);

    // Summary by space
    const bySpace = {};
    for (const s of spaces) bySpace[s.id] = { name: s.name, asig: 0, anal: 0 };
    const finalSnap = await db.collection('space_tasks').where('team_id', '==', UID).get();
    finalSnap.docs.forEach(d => {
        const data = d.data();
        if (bySpace[data.space_id]) {
            if (data.list_type === 'asignaciones') bySpace[data.space_id].asig++;
            else bySpace[data.space_id].anal++;
        }
    });
    console.log('\nFinal distribution:');
    for (const [, info] of Object.entries(bySpace)) {
        console.log(`  ${info.name}: ${info.asig} asignaciones, ${info.anal} analisis`);
    }
}

run().catch(console.error);
