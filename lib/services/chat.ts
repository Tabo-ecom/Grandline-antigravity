import { db } from '@/lib/firebase/config';
import {
    collection, doc, getDoc, setDoc, deleteDoc,
    query, where, getDocs, orderBy, limit as fbLimit,
    onSnapshot, writeBatch, Unsubscribe,
} from 'firebase/firestore';

// ─── Types ───

export interface ChatChannel {
    id: string;
    name: string;
    type: 'public' | 'private' | 'dm';
    description: string;
    team_id: string;
    members: string[]; // UIDs (for private/dm)
    created_by: string;
    created_at: number;
    last_message_at: number;
    order_index: number;
}

export interface ChatMessage {
    id: string;
    channel_id: string;
    text: string;
    author_uid: string;
    author_name: string;
    author_avatar?: string;
    timestamp: number;
    attachments: ChatAttachment[];
    thread_id?: string;
    edited?: boolean;
    // Reply
    reply_to_id?: string;
    reply_to_name?: string;
    reply_to_text?: string;
}

export interface TeamMemberProfile {
    uid: string;
    name: string;
    email: string;
    role: string;
    avatar_url: string;
    initials: string;
    color: string;
    status: 'online' | 'offline' | 'away';
}

export interface ChatAttachment {
    name: string;
    url: string;
    type: string; // 'image' | 'file' | 'link'
    size?: string;
}

const CHANNELS_COL = 'chat_channels';
const MESSAGES_COL = 'chat_messages';

// ─── Channels ───

export async function getChannels(teamId: string): Promise<ChatChannel[]> {
    const q = query(
        collection(db, CHANNELS_COL),
        where('team_id', '==', teamId),
        orderBy('order_index', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatChannel));
}

export async function saveChannel(channel: ChatChannel): Promise<void> {
    await setDoc(doc(db, CHANNELS_COL, channel.id), channel);
}

export async function deleteChannel(channelId: string): Promise<void> {
    await deleteDoc(doc(db, CHANNELS_COL, channelId));
}

// ─── Messages ───

export async function getMessages(channelId: string, messageLimit = 50): Promise<ChatMessage[]> {
    const q = query(
        collection(db, MESSAGES_COL),
        where('channel_id', '==', channelId),
        orderBy('timestamp', 'desc'),
        fbLimit(messageLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
}

export async function sendMessage(msg: ChatMessage): Promise<void> {
    await setDoc(doc(db, MESSAGES_COL, msg.id), msg);
    // Update channel last_message_at
    await setDoc(doc(db, CHANNELS_COL, msg.channel_id), { last_message_at: msg.timestamp }, { merge: true });
}

export async function deleteMessage(msgId: string): Promise<void> {
    await deleteDoc(doc(db, MESSAGES_COL, msgId));
}

/** Subscribe to real-time messages for a channel */
export function subscribeToMessages(channelId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe {
    const q = query(
        collection(db, MESSAGES_COL),
        where('channel_id', '==', channelId),
        orderBy('timestamp', 'desc'),
        fbLimit(100)
    );
    return onSnapshot(q, (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)).reverse();
        callback(msgs);
    });
}

// ─── Helpers ───

export function createChannelId(): string {
    return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Seed default channels (based on user's Slack structure) ───

export const DEFAULT_CHANNELS: Omit<ChatChannel, 'id' | 'team_id' | 'created_by' | 'created_at'>[] = [
    { name: 'equipo', type: 'public', description: 'Canal general del equipo', members: [], last_message_at: 0, order_index: 0 },
    { name: 'anuncios', type: 'public', description: 'Anuncios importantes', members: [], last_message_at: 0, order_index: 1 },
    { name: 'servicio-al-cliente', type: 'public', description: 'Casos y reportes de servicio', members: [], last_message_at: 0, order_index: 2 },
    { name: 'publicidad', type: 'public', description: 'Campanas, ROAS, creativos', members: [], last_message_at: 0, order_index: 3 },
    { name: 'creativos', type: 'public', description: 'Videos, imagenes, UGC', members: [], last_message_at: 0, order_index: 4 },
    { name: 'garantias', type: 'public', description: 'Garantias y devoluciones', members: [], last_message_at: 0, order_index: 5 },
    { name: 'ideas-videos', type: 'public', description: 'Ideas para contenido y videos', members: [], last_message_at: 0, order_index: 6 },
    { name: 'reportes', type: 'public', description: 'Reportes automaticos y manuales', members: [], last_message_at: 0, order_index: 7 },
    { name: 'tienda-lucent', type: 'public', description: 'Canal de la tienda Lucent', members: [], last_message_at: 0, order_index: 8 },
    { name: 'tienda-naturalskin', type: 'public', description: 'Canal de la tienda Natural Skin', members: [], last_message_at: 0, order_index: 9 },
];

export async function seedDefaultChannels(teamId: string, createdBy: string): Promise<ChatChannel[]> {
    const channels: ChatChannel[] = [];
    const batch = writeBatch(db);

    for (const ch of DEFAULT_CHANNELS) {
        const channel: ChatChannel = {
            ...ch,
            id: createChannelId(),
            team_id: teamId,
            created_by: createdBy,
            created_at: Date.now(),
        };
        channels.push(channel);
        batch.set(doc(db, CHANNELS_COL, channel.id), channel);
    }

    await batch.commit();
    return channels;
}

/** Get or create a DM channel between two users */
export async function getOrCreateDMChannel(teamId: string, myUid: string, myName: string, otherName: string): Promise<ChatChannel> {
    // Check if DM already exists
    const q = query(collection(db, CHANNELS_COL), where('team_id', '==', teamId), where('type', '==', 'dm'));
    const snap = await getDocs(q);
    const existing = snap.docs.find(d => {
        const data = d.data();
        return data.members?.includes(myName) && data.members?.includes(otherName);
    });
    if (existing) return { id: existing.id, ...existing.data() } as ChatChannel;

    // Create new DM
    const channel: ChatChannel = {
        id: createChannelId(),
        name: `dm-${myName}-${otherName}`.toLowerCase().replace(/\s+/g, '-').slice(0, 50),
        type: 'dm',
        description: '',
        team_id: teamId,
        members: [myName, otherName],
        created_by: myUid,
        created_at: Date.now(),
        last_message_at: 0,
        order_index: 999,
    };
    await setDoc(doc(db, CHANNELS_COL, channel.id), channel);
    return channel;
}

/** Team member profiles */
export const TEAM_PROFILES: TeamMemberProfile[] = [
    { uid: '', name: 'Gustavo M.', email: 'ceo@taboecom.com', role: 'CEO / Admin', avatar_url: '', initials: 'GM', color: '#22c55e', status: 'online' },
    { uid: '', name: 'Luisa Garcia', email: 'premiumhome.help@gmail.com', role: 'Lider Operaciones', avatar_url: '', initials: 'LG', color: '#f59e0b', status: 'online' },
    { uid: '', name: 'Aurora Quejada', email: 'auroraquejadaglgroup@gmail.com', role: 'Creativa / Editora', avatar_url: '', initials: 'AQ', color: '#aa2fff', status: 'offline' },
    { uid: '', name: 'Andres Candamil', email: 'essentialsandrescandamil@gmail.com', role: 'Publicidad', avatar_url: '', initials: 'AC', color: '#d60800', status: 'offline' },
    { uid: '', name: 'Alejandra', email: 'alejandra@glgroup.co', role: 'Servicio al Cliente', avatar_url: '', initials: 'AL', color: '#3b82f6', status: 'offline' },
    { uid: '', name: 'Carolina', email: 'carolina@glgroup.co', role: 'Editora de Video', avatar_url: '', initials: 'CA', color: '#ec4899', status: 'offline' },
];
