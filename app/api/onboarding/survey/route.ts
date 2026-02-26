import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        const { answers, userName } = await req.json();

        if (!answers) {
            return NextResponse.json({ error: 'No answers provided' }, { status: 400 });
        }

        const recipientEmail = process.env.SURVEY_EMAIL_TO;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!recipientEmail || !smtpUser || !smtpPass) {
            console.warn('[Survey] Email not configured (SURVEY_EMAIL_TO, SMTP_USER, SMTP_PASS). Skipping email.');
            return NextResponse.json({ success: true, emailSent: false });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: smtpUser, pass: smtpPass },
        });

        const html = `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                <div style="background: linear-gradient(135deg, #d75c33, #c04e2a); color: white; padding: 20px 24px; border-radius: 16px 16px 0 0;">
                    <h2 style="margin: 0; font-size: 18px;">Nueva Respuesta de Onboarding</h2>
                    <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">${userName || 'Usuario nuevo'} - ${new Date().toLocaleDateString('es-CO')}</p>
                </div>
                <div style="background: #f8f9fa; padding: 24px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 16px 16px;">
                    <div style="margin-bottom: 16px;">
                        <p style="font-size: 11px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Ordenes mensuales</p>
                        <p style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 0;">${answers.monthlyOrders}</p>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <p style="font-size: 11px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Paises</p>
                        <p style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 0;">${(answers.countries || []).join(', ')}</p>
                    </div>
                    <div>
                        <p style="font-size: 11px; color: #6c757d; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px;">Objetivos</p>
                        <p style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 0;">${(answers.goals || []).join(', ')}</p>
                    </div>
                </div>
            </div>
        `;

        await transporter.sendMail({
            from: `"Grand Line" <${smtpUser}>`,
            to: recipientEmail,
            subject: `Onboarding Survey - ${userName || 'Nuevo usuario'}`,
            html,
        });

        return NextResponse.json({ success: true, emailSent: true });
    } catch (error: any) {
        console.error('[Survey API] Error:', error);
        return NextResponse.json({ success: true, emailSent: false });
    }
}
