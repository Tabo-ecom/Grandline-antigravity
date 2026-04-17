'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Loader2, Plus, Hash, Send, Paperclip, Smile, Search,
    MessageSquare, Users, Settings, X, ChevronDown, Lock, Globe,
    UserPlus, UserMinus, Shield, Reply, Mail, AtSign,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import type { UserProfile } from '@/lib/context/AuthContext';
import {
    ChatChannel, ChatMessage,
    getChannels, sendMessage, subscribeToMessages,
    createMessageId, seedDefaultChannels, saveChannel, createChannelId,
    getOrCreateDMChannel, TEAM_PROFILES,
} from '@/lib/services/chat';
import { TEAM_MEMBERS_LIST } from '@/lib/services/task-spaces';

// ─── Avatar ───
function UserAvatar({ name, size = 'sm', color, avatarUrl }: { name: string; size?: 'sm' | 'md'; color?: string; avatarUrl?: string }) {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const bg = color || `hsl(${name.charCodeAt(0) * 37 % 360}, 60%, 45%)`;
    const s = size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-10 h-10 text-xs';
    if (avatarUrl) {
        return <img src={avatarUrl} alt={name} className={`${s} rounded-lg object-cover shrink-0`} />;
    }
    return (
        <div className={`${s} rounded-lg flex items-center justify-center font-bold text-white shrink-0`} style={{ background: bg }}>
            {initials}
        </div>
    );
}

// ─── Format time ───
function formatMsgTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatMsgDate(ts: number) {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hoy';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

// ─── Main ───
export default function ChatPage() {
    const { user, profile, effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [showNewChannel, setShowNewChannel] = useState(false);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState<'public' | 'private'>('public');
    const [channelSearch, setChannelSearch] = useState('');
    const [showMembers, setShowMembers] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [viewingProfile, setViewingProfile] = useState<string | null>(null);
    const [loadingDM, setLoadingDM] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load channels
    useEffect(() => {
        if (!effectiveUid) return;
        (async () => {
            setLoading(true);
            const chs = await getChannels(effectiveUid);
            setChannels(chs);
            if (chs.length > 0) setSelectedChannelId(chs[0].id);
            setLoading(false);
        })();
    }, [effectiveUid]);

    // Subscribe to messages for selected channel
    const prevMsgCountRef = useRef(0);
    useEffect(() => {
        if (!selectedChannelId) return;
        const unsub = subscribeToMessages(selectedChannelId, (msgs) => {
            // Push notification for new messages from others
            if (msgs.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.author_uid !== user?.uid) {
                    const channelName = channels.find(c => c.id === selectedChannelId)?.name || 'chat';
                    const notify = (window as any).__grandlineNotify;
                    if (notify) notify(`#${channelName}`, `${lastMsg.author_name}: ${lastMsg.text.slice(0, 100)}`, '/chat');
                }
            }
            prevMsgCountRef.current = msgs.length;
            setMessages(msgs);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => { unsub(); prevMsgCountRef.current = 0; };
    }, [selectedChannelId, user?.uid, channels]);

    // Seed default channels
    const handleSeed = useCallback(async () => {
        if (!effectiveUid || !user?.uid) return;
        setSeeding(true);
        const chs = await seedDefaultChannels(effectiveUid, user.uid);
        setChannels(chs);
        if (chs.length > 0) setSelectedChannelId(chs[0].id);
        setSeeding(false);
    }, [effectiveUid, user?.uid]);

    // Send message
    const handleSend = useCallback(async () => {
        if (!newMessage.trim() || !selectedChannelId || !user?.uid) return;
        setSending(true);
        const displayName = (profile as UserProfile)?.display_name || user.email?.split('@')[0] || 'Usuario';
        const msg: ChatMessage = {
            id: createMessageId(),
            channel_id: selectedChannelId,
            text: newMessage.trim(),
            author_uid: user.uid,
            author_name: displayName,
            author_avatar: (profile as UserProfile)?.avatar_url || '',
            timestamp: Date.now(),
            attachments: [],
            ...(replyTo ? {
                reply_to_id: replyTo.id,
                reply_to_name: replyTo.author_name,
                reply_to_text: replyTo.text.slice(0, 100),
            } : {}),
        };
        await sendMessage(msg);
        // FCM push is now handled by Cloud Function (onNewChatMessage)
        setNewMessage('');
        setReplyTo(null);
        setSending(false);
        inputRef.current?.focus();
    }, [newMessage, selectedChannelId, user, profile]);

    // Create channel
    const handleCreateChannel = useCallback(async () => {
        if (!newChannelName.trim() || !effectiveUid || !user?.uid) return;
        const channel: ChatChannel = {
            id: createChannelId(),
            name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
            type: newChannelType,
            description: '',
            team_id: effectiveUid,
            members: newChannelType === 'private' ? [user.uid] : [],
            created_by: user.uid,
            created_at: Date.now(),
            last_message_at: 0,
            order_index: channels.length,
        };
        await saveChannel(channel);
        setChannels(prev => [...prev, channel]);
        setSelectedChannelId(channel.id);
        setNewChannelName('');
        setNewChannelType('public');
        setShowNewChannel(false);
    }, [newChannelName, newChannelType, effectiveUid, user?.uid, channels.length]);

    const selectedChannel = useMemo(() => channels.find(c => c.id === selectedChannelId), [channels, selectedChannelId]);

    // Toggle member in channel
    const handleToggleMember = useCallback(async (memberName: string) => {
        if (!selectedChannel) return;
        const members = [...selectedChannel.members];
        const idx = members.indexOf(memberName);
        if (idx >= 0) members.splice(idx, 1);
        else members.push(memberName);
        const updated = { ...selectedChannel, members };
        await saveChannel(updated);
        setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
    }, [selectedChannel]);

    // Toggle channel type
    const handleToggleChannelType = useCallback(async () => {
        if (!selectedChannel) return;
        const newType = selectedChannel.type === 'public' ? 'private' : 'public';
        const updated = { ...selectedChannel, type: newType as 'public' | 'private', members: newType === 'public' ? [] : selectedChannel.members };
        await saveChannel(updated);
        setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
    }, [selectedChannel]);

    // Open DM with a team member
    const handleOpenDM = useCallback(async (memberName: string) => {
        if (!effectiveUid || !user?.uid) return;
        setLoadingDM(true);
        const displayName = (profile as UserProfile)?.display_name || user.email?.split('@')[0] || 'Tu';
        const channel = await getOrCreateDMChannel(effectiveUid, user.uid, displayName, memberName);
        if (!channels.find(c => c.id === channel.id)) {
            setChannels(prev => [...prev, channel]);
        }
        setSelectedChannelId(channel.id);
        setViewingProfile(null);
        setLoadingDM(false);
    }, [effectiveUid, user, profile, channels]);

    // File upload
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedChannelId || !user?.uid) return;
        setSending(true);
        try {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const { storage } = await import('@/lib/firebase/config');
            const storageRef = ref(storage, `chat-files/${selectedChannelId}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            const displayName = (profile as UserProfile)?.display_name || user.email?.split('@')[0] || 'Usuario';
            const isImage = file.type.startsWith('image/');
            const msg: ChatMessage = {
                id: createMessageId(), channel_id: selectedChannelId,
                text: isImage ? `📷 ${file.name}` : `📎 ${file.name}`,
                author_uid: user.uid, author_name: displayName, author_avatar: (profile as UserProfile)?.avatar_url || '', timestamp: Date.now(),
                attachments: [{ name: file.name, url, type: isImage ? 'image' : 'file', size: `${Math.round(file.size / 1024)}KB` }],
            };
            await sendMessage(msg);
        } catch (err) { console.error('Upload error:', err); }
        setSending(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [selectedChannelId, user, profile]);

    // Audio recording
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (blob.size < 1000) return; // too short

                if (!selectedChannelId || !user?.uid) return;
                setSending(true);
                try {
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const { storage } = await import('@/lib/firebase/config');
                    const fileName = `audio_${Date.now()}.webm`;
                    const storageRef = ref(storage, `chat-files/${selectedChannelId}/${fileName}`);
                    await uploadBytes(storageRef, blob);
                    const url = await getDownloadURL(storageRef);

                    const displayName = (profile as UserProfile)?.display_name || user.email?.split('@')[0] || 'Usuario';
                    const msg: ChatMessage = {
                        id: createMessageId(), channel_id: selectedChannelId,
                        text: `🎤 Nota de voz (${recordingTime}s)`,
                        author_uid: user.uid, author_name: displayName, author_avatar: (profile as UserProfile)?.avatar_url || '', timestamp: Date.now(),
                        attachments: [{ name: fileName, url, type: 'audio', size: `${Math.round(blob.size / 1024)}KB` }],
                    };
                    await sendMessage(msg);
                } catch (err) { console.error('Audio upload error:', err); }
                setSending(false);
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch { alert('No se pudo acceder al microfono'); }
    }, [selectedChannelId, user, profile, recordingTime]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const filteredChannels = channelSearch
        ? channels.filter(c => c.name.includes(channelSearch.toLowerCase()))
        : channels;

    // Group messages by date
    const groupedMessages: { date: string; msgs: ChatMessage[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
        const date = formatMsgDate(msg.timestamp);
        if (date !== currentDate) {
            currentDate = date;
            groupedMessages.push({ date, msgs: [msg] });
        } else {
            groupedMessages[groupedMessages.length - 1].msgs.push(msg);
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando chat...</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-48px)] -m-3 md:-m-6">
            {/* ── Channel Sidebar ── */}
            <div className={`${selectedChannelId ? 'hidden md:flex' : 'flex'} w-full md:w-[240px] bg-card/50 md:border-r border-card-border flex-col shrink-0`}>
                <div className="p-3 border-b border-card-border">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-accent" />
                            <span className="text-xs font-bold uppercase tracking-widest text-muted">Chat</span>
                        </div>
                        <button
                            onClick={() => setShowNewChannel(true)}
                            className="w-6 h-6 rounded-md bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-all"
                            title="Nuevo canal"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted/50" />
                        <input
                            value={channelSearch}
                            onChange={e => setChannelSearch(e.target.value)}
                            placeholder="Buscar canal..."
                            className="w-full bg-hover-bg border border-card-border rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-accent/30 text-foreground placeholder:text-muted/40"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {channels.length === 0 && (
                        <div className="text-center py-8 px-4">
                            <MessageSquare className="w-8 h-8 text-muted/20 mx-auto mb-3" />
                            <p className="text-[11px] text-muted/50 mb-4">No hay canales</p>
                            <button
                                onClick={handleSeed}
                                disabled={seeding}
                                className="flex items-center gap-2 mx-auto px-4 py-2 bg-accent/10 text-accent text-[11px] font-bold rounded-xl hover:bg-accent/20 transition-all border border-accent/20 disabled:opacity-50"
                            >
                                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                Crear canales por defecto
                            </button>
                        </div>
                    )}

                    <div className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-2 mb-1">Canales</div>
                    {filteredChannels.filter(c => c.type !== 'dm').map(channel => (
                        <button
                            key={channel.id}
                            onClick={() => { setSelectedChannelId(channel.id); setShowMembers(false); }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-all ${
                                selectedChannelId === channel.id
                                    ? 'bg-accent/10 text-accent font-semibold'
                                    : 'text-muted hover:text-foreground hover:bg-hover-bg'
                            }`}
                        >
                            {channel.type === 'private' ? <Lock className="w-3.5 h-3.5 shrink-0 opacity-50" /> : <Hash className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                            <span className="truncate">{channel.name}</span>
                            {channel.type === 'private' && channel.members.length > 0 && (
                                <span className="ml-auto text-[9px] text-muted/40">{channel.members.length}</span>
                            )}
                        </button>
                    ))}

                    {/* DM channels */}
                    {channels.filter(c => c.type === 'dm').length > 0 && (
                        <>
                            <div className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-2 mt-3 mb-1">Mensajes Directos</div>
                            {channels.filter(c => c.type === 'dm').map(channel => {
                                const displayName = (profile as UserProfile)?.display_name || user?.email?.split('@')[0] || '';
                                const otherPerson = channel.members.find(m => m !== displayName) || channel.name;
                                return (
                                    <button key={channel.id} onClick={() => { setSelectedChannelId(channel.id); setShowMembers(false); }}
                                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] transition-all ${selectedChannelId === channel.id ? 'bg-accent/10 text-accent font-semibold' : 'text-muted hover:text-foreground hover:bg-hover-bg'}`}>
                                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-green-400" />
                                        </div>
                                        <span className="truncate">{otherPerson}</span>
                                    </button>
                                );
                            })}
                        </>
                    )}

                    {/* Team members */}
                    <div className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-2 mt-3 mb-1">Equipo</div>
                    {TEAM_PROFILES.map(member => (
                        <button key={member.name}
                            onClick={() => handleOpenDM(member.name)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-muted hover:text-foreground hover:bg-hover-bg transition-all">
                            <div className="relative">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: member.color }}>
                                    {member.initials}
                                </div>
                                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${member.status === 'online' ? 'bg-green-400' : 'bg-muted/30'}`} />
                            </div>
                            <span className="truncate flex-1 text-left">{member.name}</span>
                            <span className="text-[9px] text-muted/30">{member.role.split('/')[0].trim()}</span>
                        </button>
                    ))}
                </div>

                {/* My profile — bottom of sidebar */}
                <div className="p-2 border-t border-card-border mt-auto shrink-0">
                    <a href="/perfil"
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-hover-bg transition-all">
                        {(profile as UserProfile)?.avatar_url ? (
                            <img src={(profile as UserProfile).avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-card-border" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                                {((profile as UserProfile)?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold truncate">{(profile as UserProfile)?.display_name || user?.email?.split('@')[0]}</div>
                            <div className="text-[9px] text-accent">Editar perfil</div>
                        </div>
                    </a>
                </div>

                {/* New channel modal */}
                {showNewChannel && (
                    <div className="p-3 border-t border-card-border bg-card">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-muted uppercase">Nuevo Canal</span>
                            <button onClick={() => setShowNewChannel(false)} className="text-muted hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <input
                            value={newChannelName}
                            onChange={e => setNewChannelName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
                            placeholder="nombre-del-canal"
                            className="w-full bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-accent/30 text-foreground mb-2"
                            autoFocus
                        />
                        <div className="flex gap-1.5 mb-2">
                            <button onClick={() => setNewChannelType('public')}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${newChannelType === 'public' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-card-border text-muted'}`}>
                                <Globe className="w-3 h-3" /> Publico
                            </button>
                            <button onClick={() => setNewChannelType('private')}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${newChannelType === 'private' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-card-border text-muted'}`}>
                                <Lock className="w-3 h-3" /> Privado
                            </button>
                        </div>
                        <button
                            onClick={handleCreateChannel}
                            className="w-full py-2 bg-accent text-white text-[11px] font-bold rounded-lg hover:bg-accent/90 transition-all"
                        >
                            Crear
                        </button>
                    </div>
                )}
            </div>

            {/* ── Main Chat Area ── */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedChannel ? (
                    <>
                        {/* Channel Header */}
                        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2.5 md:py-3 border-b border-card-border bg-card/30 shrink-0">
                            <button onClick={() => setSelectedChannelId(null)} className="md:hidden w-7 h-7 rounded-lg bg-hover-bg flex items-center justify-center text-muted shrink-0">
                                <ChevronDown className="w-4 h-4 rotate-90" />
                            </button>
                            {selectedChannel.type === 'private' ? <Lock className="w-4 h-4 text-muted/50 hidden md:block" /> : <Hash className="w-4 h-4 text-muted/50 hidden md:block" />}
                            <h3 className="text-sm font-bold">{selectedChannel.name}</h3>
                            {selectedChannel.type === 'private' && (
                                <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">PRIVADO</span>
                            )}
                            {selectedChannel.description && (
                                <span className="text-[11px] text-muted/50 hidden md:block">
                                    {selectedChannel.description}
                                </span>
                            )}
                            <div className="flex-1" />
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted/40">{messages.length} mensajes</span>
                                <button
                                    onClick={() => setShowMembers(!showMembers)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${showMembers ? 'bg-accent/10 text-accent border-accent/20' : 'text-muted border-card-border hover:text-foreground hover:bg-hover-bg'}`}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    {selectedChannel.type === 'private' ? selectedChannel.members.length : 'Todos'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex min-h-0">
                        {/* Messages */}
                        <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {messages.length === 0 && (
                                <div className="text-center py-16">
                                    <MessageSquare className="w-10 h-10 text-muted/10 mx-auto mb-3" />
                                    <p className="text-sm text-muted/30 font-semibold">#{selectedChannel.name}</p>
                                    <p className="text-xs text-muted/20 mt-1">Se el primero en enviar un mensaje</p>
                                </div>
                            )}

                            {groupedMessages.map((group) => (
                                <div key={group.date}>
                                    <div className="flex items-center gap-3 my-4">
                                        <div className="flex-1 h-px bg-card-border" />
                                        <span className="text-[10px] font-semibold text-muted/40">{group.date}</span>
                                        <div className="flex-1 h-px bg-card-border" />
                                    </div>
                                    {group.msgs.map((msg, idx) => {
                                        const prevMsg = idx > 0 ? group.msgs[idx - 1] : null;
                                        const sameAuthor = prevMsg?.author_uid === msg.author_uid &&
                                            (msg.timestamp - (prevMsg?.timestamp || 0)) < 300000; // 5 min
                                        return (
                                            <div key={msg.id} className={`flex gap-3 group hover:bg-hover-bg/30 px-2 py-0.5 rounded-lg -mx-2 relative ${sameAuthor ? '' : 'mt-3'}`}>
                                                {sameAuthor ? (
                                                    <div className="w-8 shrink-0">
                                                        <span className="text-[9px] text-muted/0 group-hover:text-muted/30 font-mono">
                                                            {formatMsgTime(msg.timestamp)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <UserAvatar name={msg.author_name} avatarUrl={msg.author_avatar} />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    {!sameAuthor && (
                                                        <div className="flex items-baseline gap-2 mb-0.5">
                                                            <span className="text-[12px] font-bold">{msg.author_name}</span>
                                                            <span className="text-[9px] text-muted/30 font-mono">{formatMsgTime(msg.timestamp)}</span>
                                                        </div>
                                                    )}
                                                    {/* Reply context */}
                                                    {msg.reply_to_id && (
                                                        <div className="flex items-center gap-1.5 mb-1 pl-2 border-l-2 border-accent/30">
                                                            <Reply className="w-3 h-3 text-accent/50 shrink-0" />
                                                            <span className="text-[10px] font-bold text-accent/60">{msg.reply_to_name}</span>
                                                            <span className="text-[10px] text-muted/40 truncate">{msg.reply_to_text}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-[13px] text-foreground/90 leading-relaxed break-words whitespace-pre-wrap">
                                                        {msg.text}
                                                    </p>
                                                    {/* Attachments */}
                                                    {msg.attachments?.map((att, ai) => (
                                                        <div key={ai} className="mt-1.5">
                                                            {att.type === 'image' ? (
                                                                <a href={att.url} target="_blank" rel="noopener">
                                                                    <img src={att.url} alt={att.name} className="max-w-[300px] max-h-[200px] rounded-lg border border-card-border object-cover" />
                                                                </a>
                                                            ) : att.type === 'audio' ? (
                                                                <audio controls className="max-w-[280px] h-8" src={att.url} />
                                                            ) : (
                                                                <a href={att.url} target="_blank" rel="noopener"
                                                                    className="inline-flex items-center gap-2 px-3 py-2 bg-hover-bg border border-card-border rounded-lg text-xs hover:border-accent/30 transition-all">
                                                                    <Paperclip className="w-3.5 h-3.5 text-muted" />
                                                                    <span className="font-medium">{att.name}</span>
                                                                    <span className="text-muted/40">{att.size}</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Reply button */}
                                                <button
                                                    onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                                                    className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 w-6 h-6 rounded bg-hover-bg border border-card-border flex items-center justify-center text-muted hover:text-accent transition-all"
                                                    title="Responder"
                                                >
                                                    <Reply className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="px-3 md:px-5 py-2 md:py-3 border-t border-card-border bg-card/30 shrink-0">
                            {/* Reply preview */}
                            {replyTo && (
                                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-accent/5 border border-accent/10 rounded-lg">
                                    <Reply className="w-3.5 h-3.5 text-accent shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-bold text-accent">{replyTo.author_name}</span>
                                        <p className="text-[11px] text-muted truncate">{replyTo.text}</p>
                                    </div>
                                    <button onClick={() => setReplyTo(null)} className="text-muted/40 hover:text-muted shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" />
                            {isRecording ? (
                                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-sm font-bold text-red-400">Grabando... {recordingTime}s</span>
                                    <div className="flex-1" />
                                    <button onClick={stopRecording} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-all">
                                        Enviar audio
                                    </button>
                                    <button onClick={() => { if (mediaRecorderRef.current) { mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); } setIsRecording(false); if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); }}
                                        className="text-muted hover:text-red-400"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 bg-hover-bg border border-card-border rounded-xl px-3 py-2 focus-within:border-accent/30 transition-all">
                                    <button onClick={() => fileInputRef.current?.click()} className="text-muted/40 hover:text-muted transition-all shrink-0" title="Adjuntar archivo">
                                        <Paperclip className="w-4 h-4" />
                                    </button>
                                    <input
                                        ref={inputRef}
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={`Escribe en #${selectedChannel.name}...`}
                                        className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground placeholder:text-muted/30"
                                    />
                                    <button onClick={startRecording} className="text-muted/40 hover:text-accent transition-all shrink-0" title="Nota de voz">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" /></svg>
                                    </button>
                                    <button onClick={handleSend} disabled={!newMessage.trim() || sending}
                                        className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0">
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                        </div> {/* end messages+input column */}

                        {/* Members Panel */}
                        {showMembers && (
                            <div className="hidden md:flex w-[260px] border-l border-card-border bg-card/50 flex-col shrink-0">
                                <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-muted uppercase tracking-widest">Miembros</span>
                                    <button onClick={() => setShowMembers(false)} className="text-muted hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                                </div>

                                {/* Channel type toggle */}
                                <div className="px-4 py-3 border-b border-card-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-muted">Tipo de canal</span>
                                    </div>
                                    <button onClick={handleToggleChannelType}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                                            selectedChannel.type === 'private'
                                                ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                                                : 'bg-green-400/10 text-green-400 border-green-400/20'
                                        }`}>
                                        {selectedChannel.type === 'private' ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                                        {selectedChannel.type === 'private' ? 'Privado — Solo miembros' : 'Publico — Todos pueden ver'}
                                    </button>
                                    {selectedChannel.type === 'public' && (
                                        <p className="text-[9px] text-muted/40 mt-1.5">Todos los miembros del equipo pueden ver y escribir en este canal.</p>
                                    )}
                                </div>

                                {/* Members list */}
                                {selectedChannel.type === 'private' && (
                                    <div className="flex-1 overflow-y-auto px-4 py-3">
                                        <div className="text-[9px] text-muted/40 mb-2">
                                            {selectedChannel.members.length} miembro{selectedChannel.members.length !== 1 ? 's' : ''} con acceso
                                        </div>
                                        {TEAM_MEMBERS_LIST.map(member => {
                                            const isMember = selectedChannel.members.includes(member.name);
                                            return (
                                                <div key={member.name}
                                                    className="flex items-center gap-2.5 py-2 border-b border-card-border/20">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                        style={{ background: member.color }}>
                                                        {member.initials}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[12px] font-medium truncate">{member.name}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleMember(member.name)}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                                            isMember
                                                                ? 'bg-green-400/10 text-green-400 hover:bg-red-400/10 hover:text-red-400'
                                                                : 'bg-hover-bg text-muted hover:text-accent hover:bg-accent/10'
                                                        }`}
                                                        title={isMember ? 'Quitar acceso' : 'Dar acceso'}
                                                    >
                                                        {isMember ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {selectedChannel.type === 'public' && (
                                    <div className="flex-1 overflow-y-auto px-4 py-3">
                                        <div className="text-[9px] text-muted/40 mb-2">Todo el equipo</div>
                                        {TEAM_MEMBERS_LIST.map(member => (
                                            <div key={member.name} className="flex items-center gap-2.5 py-2 border-b border-card-border/20">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                    style={{ background: member.color }}>
                                                    {member.initials}
                                                </div>
                                                <div className="text-[12px] font-medium">{member.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        </div> {/* end flex row */}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                        <MessageSquare className="w-16 h-16 text-muted/10 mb-4" />
                        <h2 className="text-lg font-bold text-muted/30 mb-2">Selecciona un canal</h2>
                        <p className="text-xs text-muted/20 max-w-sm">
                            Elige un canal para empezar a chatear con tu equipo
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
