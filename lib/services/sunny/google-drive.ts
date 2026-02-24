"use client";

import { getAdSettings } from '../marketing';

/**
 * Google Drive Service - Asset picking for Módulo Sunny
 * Integrates with the Google Picker API and Google Identity Services (GSI).
 */

export interface GDriveFile {
    id: string;
    name: string;
    mimeType: string;
    thumbnailUrl: string;
    downloadUrl?: string; // Original URL for the file
}

let gapiInited = false;
let gsiInited = false;

/**
 * Load required Google scripts dynamically
 */
async function loadScripts(): Promise<void> {
    const loadScript = (src: string, id: string) => {
        return new Promise<void>((resolve, reject) => {
            if (document.getElementById(id)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.id = id;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.body.appendChild(script);
        });
    };

    await Promise.all([
        loadScript('https://apis.google.com/js/api.js', 'google-api'),
        loadScript('https://accounts.google.com/gsi/client', 'google-gsi')
    ]);
}

/**
 * Initialize GAPI client for Picker
 */
async function initGapi(): Promise<void> {
    return new Promise((resolve) => {
        window.gapi.load('picker', {
            callback: () => {
                gapiInited = true;
                resolve();
            }
        });
    });
}

/**
 * Open the Google Drive Picker
 */
export async function openDrivePicker(userId: string): Promise<GDriveFile[] | null> {
    try {
        const settings = await getAdSettings(userId);
        // Fallback to environment variables if not in settings
        const apiKey = settings?.google_api_key || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
        const clientId = settings?.google_client_id || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

        if (!apiKey || !clientId) {
            console.error("Faltan credenciales de Google (API Key o Client ID) en la configuración.");
            alert("No se pudo abrir Google Drive. Por favor, configura tu API Key y Client ID en los Ajustes.");
            return null;
        }

        await loadScripts();
        if (!gapiInited) await initGapi();

        return new Promise((resolve) => {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.readonly',
                callback: async (response: any) => {
                    if (response.error !== undefined) {
                        console.error("Auth error:", response);
                        resolve(null);
                        return;
                    }

                    const accessToken = response.access_token;
                    createPicker(accessToken, apiKey, (files) => resolve(files));
                },
            });

            // Request token automatically
            tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    } catch (error) {
        console.error("Error opening Google Drive Picker:", error);
        return null;
    }
}

/**
 * Create and show the Picker
 */
function createPicker(accessToken: string, apiKey: string, resolve: (val: GDriveFile[] | null) => void) {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
    view.setMimeTypes('image/png,image/jpeg,image/jpg,video/mp4,video/quicktime');

    const picker = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setAppId(apiKey) // Standard to use API Key here for simple apps
        .setOAuthToken(accessToken)
        .addView(view)
        .addView(new window.google.picker.DocsUploadView()) // Allow direct upload to drive too
        .setDeveloperKey(apiKey)
        .setCallback((data: any) => {
            if (data.action === window.google.picker.Action.PICKED) {
                const files: GDriveFile[] = data.docs.map((doc: any) => ({
                    id: doc.id,
                    name: doc.name,
                    mimeType: doc.mimeType,
                    thumbnailUrl: doc.thumbnails?.[0]?.url || doc.iconUrl,
                    downloadUrl: doc.url
                }));
                resolve(files);
            } else if (data.action === window.google.picker.Action.CANCEL) {
                resolve(null);
            }
        })
        .build();

    picker.setVisible(true);
}

// Global type declarations for Google libraries
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}
