/**
 * Quick test: VEGA email via Nodemailer
 * Usage: node scripts/test-email.mjs
 */
import { readFileSync } from 'fs';
import { createTransport } from 'nodemailer';

// Parse .env.local manually (no dotenv)
const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/);
    if (m) env[m[1]] = m[2];
}

const host = env.SMTP_HOST;
const port = Number(env.SMTP_PORT) || 465;
const user = env.SMTP_USER;
const pass = env.SMTP_PASS;
const from = env.SMTP_FROM || user;

console.log(`SMTP Config: ${host}:${port} user=${user}`);

const transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
});

try {
    const info = await transporter.sendMail({
        from,
        to: 'ceo@taboecom.com',
        subject: '🧭 VEGA Test — Email Funcionando',
        html: `
            <div style="font-family: 'Space Grotesk', sans-serif; background: #0A0A0F; color: #e5e5e5; padding: 40px; border-radius: 16px;">
                <h1 style="color: #d75c33; margin: 0 0 16px;">⚡ VEGA AI — Test Exitoso</h1>
                <p style="font-size: 16px; line-height: 1.6;">
                    El servicio de email de VEGA está funcionando correctamente desde
                    <strong style="color: #d75c33;">vega@grandline.com.co</strong>
                </p>
                <hr style="border: 1px solid #222; margin: 24px 0;">
                <p style="color: #888; font-size: 13px;">Grand Line v8 • ${new Date().toLocaleString('es-CO')}</p>
            </div>
        `,
    });
    console.log('✅ Email enviado:', info.messageId);
} catch (err) {
    console.error('❌ Error:', err.message);
    if (err.code) console.error('   Code:', err.code);
}
