import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { getWorkspaceStructure, getTasks, getAllTasks } from '@/lib/services/clickup';

const API_KEY = process.env.CLICKUP_API_KEY || '';
const TEAM_ID = process.env.CLICKUP_TEAM_ID || '';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        if (!API_KEY || !TEAM_ID) {
            return NextResponse.json({ error: 'ClickUp no configurado' }, { status: 400 });
        }

        if (action === 'structure') {
            const structure = await getWorkspaceStructure(API_KEY, TEAM_ID);
            return NextResponse.json(structure);
        }

        if (action === 'tasks') {
            const listId = searchParams.get('listId');
            const includeClosed = searchParams.get('includeClosed') === 'true';
            if (!listId) {
                return NextResponse.json({ error: 'listId requerido' }, { status: 400 });
            }
            const tasks = await getTasks(API_KEY, listId, includeClosed);
            return NextResponse.json({ tasks });
        }

        if (action === 'all-tasks') {
            const listIds = searchParams.get('listIds')?.split(',').filter(Boolean);
            if (!listIds?.length) {
                return NextResponse.json({ error: 'listIds requerido' }, { status: 400 });
            }
            const tasks = await getAllTasks(API_KEY, listIds, searchParams.get('includeClosed') === 'true');
            return NextResponse.json({ tasks });
        }

        return NextResponse.json({ error: 'action invalida. Usar: structure, tasks, all-tasks' }, { status: 400 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error conectando con ClickUp';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
