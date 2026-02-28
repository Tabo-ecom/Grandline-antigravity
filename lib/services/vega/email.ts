/**
 * Vega AI - Email Service (Nodemailer)
 */

import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    return transporter;
}

export async function sendReportEmail(
    to: string,
    subject: string,
    html: string
): Promise<boolean> {
    try {
        const transport = getTransporter();
        const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'vega@grandline.app';

        await transport.sendMail({
            from,
            to,
            subject,
            html,
        });

        return true;
    } catch (err) {
        console.error('Error sending email:', err);
        return false;
    }
}
