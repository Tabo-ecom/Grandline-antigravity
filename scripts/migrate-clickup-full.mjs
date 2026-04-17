/**
 * Re-migrate ClickUp tasks with FULL data: descriptions, checklists, attachments, comments
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

const tasks = JSON.parse(readFileSync('/tmp/clickup_full_tasks.json', 'utf-8'));

function mapStatus(s) {
    s = (s || '').toLowerCase();
    if (s.includes('completado') || s.includes('complete')) return 'completado';
    if (s.includes('progreso')) return 'en_progreso';
    if (s.includes('espera') || s.includes('guionizado') || s.includes('editado') || s.includes('grabado')) return 'pendiente_aprobacion';
    if (s.includes('bloqueado')) return 'bloqueado';
    if (s.includes('retraso')) return 'retraso';
    if (s.includes('listo')) return 'listo_para_subir';
    return 'pendiente';
}

async function run() {
    const user = await adminAuth.getUserByEmail('ceo@taboecom.com');
    const UID = user.uid;
    console.log(`UID: ${UID}`);
    console.log(`Re-migrating ${tasks.length} tasks with full data...\n`);

    const newTasks = [];

    for (const t of tasks) {
        const name = t.name || 'Sin titulo';
        const status = mapStatus(t.status?.status);
        const assignees = (t.assignees || []).map(a => a.username || '');
        const description = t.markdown_description || t.description || '';
        const clickupUrl = t.url || '';
        const tags = (t.tags || []).map(tag => tag.name);
        const dateCreated = parseInt(t.date_created) || Date.now();
        const dateUpdated = parseInt(t.date_updated) || Date.now();
        const dueDate = t.due_date ? parseInt(t.due_date) : null;
        const startDate = t.start_date ? parseInt(t.start_date) : null;

        // Store from space/list/folder
        const spaceName = t.space?.name || t.folder?.name || t.list?.name || '';
        let store = '';
        if (spaceName.toLowerCase().includes('tabo') || (t.list?.name || '').toLowerCase().includes('tabo')) store = 'tabo';
        else if (spaceName.toLowerCase().includes('lucent')) store = 'lucent';
        else if (spaceName.toLowerCase().includes('drop')) store = 'dropshipping';

        // Activity type
        const listName = t.list?.name || '';
        const folderName = t.folder?.name || '';
        let tipoActividad = '';
        if (folderName.includes('Analisis') || listName.includes('Analisis')) tipoActividad = 'Analisis Creativos';
        else if (folderName.includes('Asignaciones') || listName.includes('asignaciones')) tipoActividad = 'Asignacion Semanal';
        else if (listName === 'Grand Line') tipoActividad = 'Desarrollo';
        else if (listName === 'Personal') tipoActividad = 'Personal';
        else if (listName === 'GL GROUP') tipoActividad = 'Gestion';
        else if (listName === 'TABO ECOM') tipoActividad = 'Contenido';

        // Priority
        let priority = 'normal';
        if (t.priority?.priority === 'urgent') priority = 'urgente';
        else if (t.priority?.priority === 'high') priority = 'alta';
        else if (t.priority?.priority === 'low') priority = 'baja';

        // Custom fields
        let linkDrive = '';
        let cuentaPublicitaria = '';
        for (const cf of (t.custom_fields || [])) {
            if (cf.name?.toLowerCase().includes('tienda') && cf.value) {
                // Store custom field
            }
            if (cf.type === 'url' && cf.value) {
                linkDrive = cf.value;
            }
        }

        // Checklists → subtasks
        const subtasks = [];
        for (const cl of (t.checklists || [])) {
            for (const item of (cl.items || [])) {
                subtasks.push({
                    id: `sub_${item.id || Date.now()}_${Math.random().toString(36).slice(2,6)}`,
                    text: item.name || '',
                    done: item.resolved || false,
                    assignee: item.assignee?.username || '',
                    assigneeType: 'person',
                });
            }
        }

        // Attachments → files
        const files = [];
        for (const att of (t.attachments || [])) {
            files.push({
                id: `file_${att.id || Date.now()}`,
                name: att.title || att.filename || 'Archivo',
                url: att.url || '',
                uploadedBy: att.creator?.username || 'ClickUp',
                size: att.size ? `${Math.round(att.size / 1024)}KB` : '',
                timestamp: parseInt(att.date) || Date.now(),
            });
        }

        // Comments
        const comments = [];
        for (const cmt of (t._comments || [])) {
            const text = (cmt.comment || []).map(c => c.text || '').join('');
            if (!text.trim()) continue;
            comments.push({
                id: `cmt_${cmt.id || Date.now()}`,
                author: cmt.user?.username || 'ClickUp',
                authorType: 'person',
                text,
                timestamp: parseInt(cmt.date) || Date.now(),
            });
        }

        // Activity log
        const activity = [];
        // Import note
        activity.push({
            id: `act_import_${t.id}`,
            type: 'person',
            agentOrPerson: 'Sistema',
            text: `Importado desde ClickUp (${listName})${tags.length ? ` — Tags: ${tags.join(', ')}` : ''}${folderName ? ` — Folder: ${folderName}` : ''}`,
            timestamp: Date.now(),
        });

        const vegaTask = {
            id: `cu_${t.id}`,
            name,
            description,
            status,
            agentId: null,
            assignees,
            store,
            product: '',
            tipoActividad,
            tipoEstrategia: '',
            linkDrive,
            urlPagina: clickupUrl,
            refVideo: '',
            refLanding: '',
            cuentaPublicitaria,
            progress: status === 'completado' ? 100 : status === 'en_progreso' ? 50 : 0,
            priority,
            templateId: null,
            subtasks,
            comments,
            files,
            activity,
            createdAt: dateCreated,
            updatedAt: dateUpdated,
            scheduledFor: dueDate,
        };

        newTasks.push(vegaTask);

        const extras = [];
        if (description) extras.push(`desc:${description.length}ch`);
        if (subtasks.length) extras.push(`subtasks:${subtasks.length}`);
        if (files.length) extras.push(`files:${files.length}`);
        if (comments.length) extras.push(`comments:${comments.length}`);
        if (extras.length) {
            console.log(`  ✓ ${name.slice(0,55).padEnd(55)} ${extras.join(', ')}`);
        }
    }

    // Replace all tasks in Firestore
    await db.collection('app_data').doc(`vega_tasks_${UID}`).set({
        value: newTasks,
        updatedAt: Date.now(),
    });

    const withDesc = newTasks.filter(t => t.description).length;
    const withFiles = newTasks.filter(t => t.files.length).length;
    const withComments = newTasks.filter(t => t.comments.length).length;
    const withSubtasks = newTasks.filter(t => t.subtasks.length).length;

    console.log(`\n✅ Migrated ${newTasks.length} tasks with full data.`);
    console.log(`   ${withDesc} with descriptions`);
    console.log(`   ${withFiles} with files/attachments`);
    console.log(`   ${withComments} with comments`);
    console.log(`   ${withSubtasks} with subtasks/checklists`);
}

run().catch(console.error);
