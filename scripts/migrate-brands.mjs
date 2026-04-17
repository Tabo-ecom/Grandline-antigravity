import { readFileSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const envContent = readFileSync('.env.local', 'utf-8');
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

const tasks = JSON.parse(readFileSync('/tmp/clickup_brand_tasks.json', 'utf-8'));

function mapStatus(s) {
    s = (s || '').toLowerCase();
    if (s.includes('completado') || s.includes('complete')) return 'completado';
    if (s.includes('progreso')) return 'en_progreso';
    if (s.includes('espera')) return 'pendiente_aprobacion';
    if (s.includes('bloqueado')) return 'bloqueado';
    if (s.includes('retraso')) return 'retraso';
    if (s.includes('listo')) return 'listo_para_subir';
    return 'pendiente';
}

async function run() {
    const user = await adminAuth.getUserByEmail('ceo@taboecom.com');
    const UID = user.uid;
    console.log(`UID: ${UID}, tasks to migrate: ${tasks.length}`);
    
    const doc = await db.collection('app_data').doc(`vega_tasks_${UID}`).get();
    const existing = doc.exists ? doc.data().value || [] : [];
    const existingNames = new Set(existing.map(t => t.name));
    
    let migrated = 0;
    const newTasks = [...existing];
    
    for (const t of tasks) {
        if (existingNames.has(t.name)) continue;
        
        const src = t._source_list || '';
        let store = '';
        if (src.includes('TABO')) store = 'tabo';
        else if (src.includes('Lucent')) store = 'lucent';
        else if (src.includes('Drop')) store = 'dropshipping';
        
        let tipo = '';
        if (src.includes('Analisis')) tipo = 'Analisis Creativos';
        else if (src.includes('Asignaciones')) tipo = 'Asignacion Semanal';
        
        newTasks.push({
            id: `cu_${t.id}`,
            name: t.name,
            description: t.description || '',
            status: mapStatus(t.status?.status),
            agentId: null,
            assignees: (t.assignees || []).map(a => a.username || ''),
            store, product: '', tipoActividad: tipo, tipoEstrategia: '',
            linkDrive: '', urlPagina: t.url || '', refVideo: '', refLanding: '',
            cuentaPublicitaria: '',
            progress: mapStatus(t.status?.status) === 'completado' ? 100 : 0,
            priority: t.priority?.priority || 'normal',
            templateId: null, subtasks: [], comments: [], files: [],
            activity: [{ id: `act_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'person', agentOrPerson: 'Sistema', text: `Importado desde ClickUp (${src})`, timestamp: Date.now() }],
            createdAt: parseInt(t.date_created) || Date.now(),
            updatedAt: parseInt(t.date_updated) || Date.now(),
            scheduledFor: t.due_date ? parseInt(t.due_date) : null,
        });
        existingNames.add(t.name);
        migrated++;
        console.log(`  ✓ [${store}] ${t.name}`);
    }
    
    if (migrated > 0) {
        await db.collection('app_data').doc(`vega_tasks_${UID}`).set({ value: newTasks, updatedAt: Date.now() });
        console.log(`\n✅ Migrated ${migrated} brand tasks. Total: ${newTasks.length}`);
    } else {
        console.log('No new tasks to migrate.');
    }
}
run().catch(console.error);
