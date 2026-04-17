'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Bell, X, MessageSquare } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { db } from '@/lib/firebase/config';
import { initFCM } from '@/lib/firebase/fcm';
import { collection, query, orderBy, limit as fbLimit, onSnapshot } from 'firebase/firestore';

interface ToastNotification {
    id: string;
    title: string;
    body: string;
    url: string;
    timestamp: number;
}

// Notification sound
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, dur: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        };
        playTone(880, 0, 0.15);
        playTone(1100, 0.12, 0.2);
    } catch {}
}

export default function PushNotifications() {
    const { user } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [showBanner, setShowBanner] = useState(false);
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const lastMsgTimestampRef = useRef(0);
    const initialLoadRef = useRef(true);

    // Register SW + auto-init FCM if already granted
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(setSwRegistration).catch(console.error);
        }
        if ('Notification' in window) {
            const perm = Notification.permission;
            setPermission(perm);
            if (perm === 'default') {
                const timer = setTimeout(() => setShowBanner(true), 5000);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    // Auto-register FCM token when permission already granted
    useEffect(() => {
        if (permission === 'granted' && user?.uid) {
            initFCM(user.uid).then(token => {
                if (token) console.log('FCM token registered:', token.slice(0, 20) + '...');
            }).catch(() => {});
        }
    }, [permission, user?.uid]);

    const requestPermission = async () => {
        if (!('Notification' in window)) return;
        const result = await Notification.requestPermission();
        setPermission(result);
        setShowBanner(false);
        if (result === 'granted') {
            // Initialize FCM and save token
            if (user?.uid) {
                const token = await initFCM(user.uid);
                if (token) console.log('FCM token saved');
            }
            addToast('Grand Line', 'Notificaciones activadas', '/chat');
        }
    };

    const addToast = useCallback((title: string, body: string, url: string) => {
        const toast: ToastNotification = {
            id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            title, body, url, timestamp: Date.now(),
        };
        setToasts(prev => [toast, ...prev].slice(0, 5));
        playNotificationSound();
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== toast.id));
        }, 8000);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // ── GLOBAL LISTENER: Listen for new chat messages from ANY page ──
    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, 'chat_messages'),
            orderBy('timestamp', 'desc'),
            fbLimit(1)
        );

        const unsub = onSnapshot(q, (snap) => {
            if (snap.empty) return;

            const lastDoc = snap.docs[0];
            const data = lastDoc.data();
            const msgTimestamp = data.timestamp || 0;

            // Skip initial load (don't notify for existing messages)
            if (initialLoadRef.current) {
                initialLoadRef.current = false;
                lastMsgTimestampRef.current = msgTimestamp;
                return;
            }

            // Skip if same or older message
            if (msgTimestamp <= lastMsgTimestampRef.current) return;
            lastMsgTimestampRef.current = msgTimestamp;

            // Skip own messages
            if (data.author_uid === user.uid) return;

            const title = `💬 ${data.author_name || 'Alguien'}`;
            const body = data.text?.slice(0, 120) || 'Nuevo mensaje';
            const url = '/chat';

            // In-app toast + sound (always)
            addToast(title, body, url);

            // Native browser notification (works in background tabs + shows in OS)
            if (permission === 'granted') {
                try {
                    const notif = new Notification(title, {
                        body,
                        icon: '/logos/grandline-isotipo.png',
                        tag: `chat-${Date.now()}`,
                    });
                    notif.onclick = () => { window.focus(); notif.close(); };
                    setTimeout(() => notif.close(), 6000);
                } catch {
                    // Fallback: SW notification (mobile)
                    if (swRegistration) {
                        swRegistration.showNotification(title, {
                            body,
                            icon: '/logos/grandline-isotipo.png',
                            tag: `chat-${Date.now()}`,
                            data: { url },
                        } as NotificationOptions);
                    }
                }
            }
        }, () => {}); // ignore errors

        return () => unsub();
    }, [user?.uid, permission, swRegistration, addToast]);

    return (
        <>
            {/* Permission banner */}
            {showBanner && permission === 'default' && (
                <div className="fixed bottom-4 right-4 z-[150] max-w-sm animate-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-card border border-card-border rounded-2xl p-4 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <Bell className="w-5 h-5 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold mb-1">Activar notificaciones</h4>
                                <p className="text-xs text-muted leading-relaxed mb-3">
                                    Recibe alertas con sonido cuando te envien mensajes en el chat.
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={requestPermission} className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent/90 transition-all">
                                        Activar
                                    </button>
                                    <button onClick={() => setShowBanner(false)} className="px-4 py-2 text-xs text-muted border border-card-border rounded-lg hover:bg-hover-bg transition-all">
                                        Ahora no
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setShowBanner(false)} className="text-muted/40 hover:text-muted shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notifications */}
            {toasts.length > 0 && (
                <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[360px] max-w-[90vw]">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className="bg-card border border-accent/20 rounded-xl p-3 shadow-2xl animate-in slide-in-from-right-5 duration-300 cursor-pointer hover:border-accent/40 transition-all"
                            onClick={() => { dismissToast(toast.id); router.push(toast.url); }}
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                    <MessageSquare className="w-4 h-4 text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <h4 className="text-xs font-bold text-accent">{toast.title}</h4>
                                        <span className="text-[9px] text-muted/40">ahora</span>
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{toast.body}</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }} className="text-muted/30 hover:text-muted shrink-0 mt-0.5">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
