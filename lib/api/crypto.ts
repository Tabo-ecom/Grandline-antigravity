/**
 * Server-side AES-256-GCM encryption for sensitive tokens.
 * Requires TOKEN_ENCRYPTION_KEY env var (64-char hex string = 32 bytes).
 *
 * Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer | null {
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) return null;
    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plain-text string. Returns format: `iv:authTag:ciphertext` (all hex).
 * If no encryption key is configured, returns the plain text unchanged.
 */
export function encrypt(text: string): string {
    if (!text) return text;
    const key = getKey();
    if (!key) return text;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a previously encrypted string.
 * Gracefully handles plain-text values (returns them unchanged).
 */
export function decrypt(value: string): string {
    if (!value || !value.startsWith('enc:')) return value;
    const key = getKey();
    if (!key) return value;

    try {
        const parts = value.split(':');
        if (parts.length !== 4) return value;
        const [, ivHex, authTagHex, ciphertext] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch {
        // If decryption fails, return as-is (may be corrupted or wrong key)
        return value;
    }
}

/** Fields in AdSettings that contain sensitive tokens */
export const SENSITIVE_FIELDS = ['fb_token', 'tt_token', 'ai_api_key'] as const;

/** Encrypt all sensitive fields in a settings object */
export function encryptSettings(settings: Record<string, any>): Record<string, any> {
    const result = { ...settings };
    for (const field of SENSITIVE_FIELDS) {
        if (result[field] && typeof result[field] === 'string' && !result[field].startsWith('enc:')) {
            result[field] = encrypt(result[field]);
        }
    }
    return result;
}

/** Decrypt all sensitive fields in a settings object */
export function decryptSettings(settings: Record<string, any>): Record<string, any> {
    const result = { ...settings };
    for (const field of SENSITIVE_FIELDS) {
        if (result[field] && typeof result[field] === 'string') {
            result[field] = decrypt(result[field]);
        }
    }
    return result;
}
