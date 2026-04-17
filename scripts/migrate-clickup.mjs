/**
 * Migrate ClickUp tasks to Grand Line Tareas (Firestore)
 * Usage: node scripts/migrate-clickup.mjs
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

// ─── Load ClickUp data ───
const tasks = JSON.parse(readFileSync('/tmp/clickup_tasks.json', 'utf-8'));

// ─── Status mapping ───
function mapStatus(cuStatus) {
    const s = (cuStatus || '').toLowerCase();
    if (s.includes('completado') || s.includes('complete')) return 'completado';
    if (s.includes('progreso')) return 'en_progreso';
    if (s.includes('espera') || s.includes('guionizado') || s.includes('editado') || s.includes('grabado')) return 'pendiente_aprobacion';
    if (s.includes('bloqueado')) return 'bloqueado';
    if (s.includes('retraso')) return 'retraso';
    if (s.includes('listo')) return 'listo_para_subir';
    return 'pendiente';
}

function mapPriority(cuPriority) {
    if (!cuPriority) return 'normal';
    const p = cuPriority.toLowerCase();
    if (p === 'urgent') return 'urgente';
    if (p === 'high') return 'alta';
    if (p === 'low') return 'baja';
    return 'normal';
}

async function migrate() {
    // Resolve UID from email
    const email = process.argv[2] || 'ceo@taboecom.com';
    const firebaseUser = await adminAuth.getUserByEmail(email);
    const TARGET_UID = firebaseUser.uid;
    console.log(`\nUser: ${email} → UID: ${TARGET_UID}`);
    console.log(`Migrating ${tasks.length} ClickUp tasks to Firestore...\n`);

    // Load existing tasks to avoid duplicates
    const existingDoc = await db.collection('app_data').doc(`vega_tasks_${TARGET_UID}`).get();
    const existingTasks = existingDoc.exists ? existingDoc.data().value || [] : [];
    const existingNames = new Set(existingTasks.map(t => t.name));

    let migrated = 0;
    let skipped = 0;
    const newTasks = [...existingTasks];

    for (const task of tasks) {
        const name = task.name || 'Sin titulo';

        // Skip if already exists
        if (existingNames.has(name)) {
            skipped++;
            continue;
        }

        const status = mapStatus(task.status?.status);
        const priority = mapPriority(task.priority?.priority);
        const assignees = (task.assignees || []).map(a => a.username || a.email || 'Sin asignar');
        const description = task.description || '';
        const sourceList = task._source_list || '';
        const clickupUrl = task.url || '';
        const tags = (task.tags || []).map(t => t.name);
        const dateCreated = parseInt(task.date_created) || Date.now();
        const dateUpdated = parseInt(task.date_updated) || Date.now();
        const dueDate = task.due_date ? parseInt(task.due_date) : null;

        // Determine store based on source list
        let store = '';
        if (sourceList.includes('TABO')) store = 'tabo';
        else if (sourceList.includes('Lucent')) store = 'lucent';
        else if (sourceList.includes('Drop')) store = 'dropshipping';

        // Determine activity type
        let tipoActividad = '';
        if (sourceList.includes('Analisis')) tipoActividad = 'Analisis';
        else if (sourceList.includes('Asignaciones')) tipoActividad = 'Asignacion Semanal';
        else if (sourceList === 'Grand Line') tipoActividad = 'Desarrollo';
        else if (sourceList === 'Personal') tipoActividad = 'Personal';
        else if (sourceList === 'GL GROUP') tipoActividad = 'Gestion';
        else if (sourceList === 'TABO ECOM') tipoActividad = 'Contenido';

        const vegaTask = {
            id: `cu_${task.id}`,
            name,
            description,
            status,
            agentId: null,
            assignees,
            store,
            product: '',
            tipoActividad,
            tipoEstrategia: '',
            linkDrive: '',
            urlPagina: clickupUrl,  // Store ClickUp URL in urlPagina
            refVideo: '',
            refLanding: '',
            cuentaPublicitaria: '',
            progress: status === 'completado' ? 100 : status === 'en_progreso' ? 50 : 0,
            priority,
            templateId: null,
            subtasks: [],
            comments: [],
            files: [],
            activity: [
                {
                    id: `act_import_${Date.now()}`,
                    type: 'person',
                    agentOrPerson: 'Sistema',
                    text: `Importado desde ClickUp (${sourceList})${tags.length ? ` — Tags: ${tags.join(', ')}` : ''}`,
                    timestamp: Date.now(),
                }
            ],
            createdAt: dateCreated,
            updatedAt: dateUpdated,
            scheduledFor: dueDate,
        };

        newTasks.push(vegaTask);
        existingNames.add(name);
        migrated++;
        console.log(`  ✓ ${name} [${status}] → ${sourceList}`);
    }

    // Save to Firestore
    if (migrated > 0) {
        await db.collection('app_data').doc(`vega_tasks_${TARGET_UID}`).set({
            value: newTasks,
            updatedAt: Date.now(),
        });
        console.log(`\n✅ Migrated ${migrated} tasks. Skipped ${skipped} duplicates.`);
        console.log(`Total tasks in Firestore: ${newTasks.length}`);
    } else {
        console.log(`\nNo new tasks to migrate. ${skipped} already exist.`);
    }
}

migrate().catch(console.error);
