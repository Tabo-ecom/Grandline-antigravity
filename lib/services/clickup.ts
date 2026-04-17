const CLICKUP_API = 'https://api.clickup.com/api/v2';

interface ClickUpRequestOptions {
    method?: string;
    body?: unknown;
}

async function clickupFetch<T>(path: string, apiKey: string, opts?: ClickUpRequestOptions): Promise<T> {
    const res = await fetch(`${CLICKUP_API}${path}`, {
        method: opts?.method || 'GET',
        headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
        },
        ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ClickUp API ${res.status}: ${text}`);
    }
    return res.json();
}

// ─── Types ───

export interface ClickUpMember {
    id: number;
    username: string;
    email: string;
    color: string | null;
    profilePicture: string | null;
    initials: string;
}

export interface ClickUpStatus {
    status: string;
    type: string;
    color: string;
    orderindex: number;
}

export interface ClickUpSpace {
    id: string;
    name: string;
    statuses: ClickUpStatus[];
}

export interface ClickUpFolder {
    id: string;
    name: string;
    lists: ClickUpList[];
}

export interface ClickUpList {
    id: string;
    name: string;
    task_count?: number;
    folder?: { id: string; name: string };
    space?: { id: string; name: string };
}

export interface ClickUpTask {
    id: string;
    name: string;
    description?: string;
    status: { status: string; color: string; type: string };
    priority?: { priority: string; color: string } | null;
    assignees: ClickUpMember[];
    due_date?: string | null;
    start_date?: string | null;
    date_created: string;
    date_updated: string;
    creator: { id: number; username: string };
    list: { id: string; name: string };
    folder?: { id: string; name: string };
    space: { id: string };
    tags: { name: string; tag_fg: string; tag_bg: string }[];
    url: string;
    subtasks?: ClickUpTask[];
}

// ─── API Functions ───

export async function getSpaces(apiKey: string, teamId: string): Promise<ClickUpSpace[]> {
    const data = await clickupFetch<{ spaces: ClickUpSpace[] }>(`/team/${teamId}/space?archived=false`, apiKey);
    return data.spaces;
}

export async function getFolders(apiKey: string, spaceId: string): Promise<ClickUpFolder[]> {
    const data = await clickupFetch<{ folders: ClickUpFolder[] }>(`/space/${spaceId}/folder?archived=false`, apiKey);
    return data.folders;
}

export async function getLists(apiKey: string, spaceId: string): Promise<ClickUpList[]> {
    const data = await clickupFetch<{ lists: ClickUpList[] }>(`/space/${spaceId}/list?archived=false`, apiKey);
    return data.lists;
}

export async function getTasks(apiKey: string, listId: string, includeClosed = false): Promise<ClickUpTask[]> {
    const data = await clickupFetch<{ tasks: ClickUpTask[] }>(
        `/list/${listId}/task?archived=false&include_closed=${includeClosed}&subtasks=true`,
        apiKey
    );
    return data.tasks;
}

export async function getTeamMembers(apiKey: string, teamId: string): Promise<ClickUpMember[]> {
    const data = await clickupFetch<{ teams: { members: { user: ClickUpMember }[] }[] }>(`/team`, apiKey);
    const team = data.teams.find(t => (t as any).id === teamId);
    if (!team) return [];
    return team.members.map(m => m.user);
}

/** Get full workspace structure: spaces → folders → lists */
export async function getWorkspaceStructure(apiKey: string, teamId: string) {
    const spaces = await getSpaces(apiKey, teamId);

    const result: {
        spaces: (ClickUpSpace & {
            folders: ClickUpFolder[];
            folderlessLists: ClickUpList[];
        })[];
    } = { spaces: [] };

    for (const space of spaces) {
        const [folders, folderlessLists] = await Promise.all([
            getFolders(apiKey, space.id),
            getLists(apiKey, space.id),
        ]);
        result.spaces.push({ ...space, folders, folderlessLists });
    }

    return result;
}

/** Fetch all tasks across multiple lists */
export async function getAllTasks(apiKey: string, listIds: string[], includeClosed = false): Promise<ClickUpTask[]> {
    const results = await Promise.all(
        listIds.map(id => getTasks(apiKey, id, includeClosed))
    );
    return results.flat();
}
