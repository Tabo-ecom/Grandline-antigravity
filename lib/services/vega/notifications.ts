/**
 * Vega AI - Notification Service (Telegram + Slack)
 */

import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import type { VegaNotificationConfig } from '@/lib/types/vega';

const CONFIG_KEY = 'vega_notification_config';

export async function getNotificationConfig(userId: string): Promise<VegaNotificationConfig> {
    if (!userId) return { telegramBotToken: '', telegramChatId: '', slackWebhookUrl: '' };
    return (await adminGetAppData<VegaNotificationConfig>(CONFIG_KEY, userId)) || {
        telegramBotToken: '',
        telegramChatId: '',
        slackWebhookUrl: '',
    };
}

export async function saveNotificationConfig(config: VegaNotificationConfig, userId: string): Promise<void> {
    await adminSetAppData(CONFIG_KEY, config, userId);
}

export async function sendTelegramMessage(botToken: string, chatId: string, message: string): Promise<boolean> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
            }),
        });
        return res.ok;
    } catch (err) {
        console.error('Error sending Telegram message:', err);
        return false;
    }
}

export async function sendSlackMessage(webhookUrl: string, message: string): Promise<boolean> {
    try {
        // Split message into Slack blocks to avoid truncation (max 3000 chars per section)
        const blocks: any[] = [];
        const paragraphs = message.split('\n\n');
        let currentText = '';

        for (const para of paragraphs) {
            if ((currentText + '\n\n' + para).length > 2800) {
                if (currentText.trim()) {
                    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: currentText.trim() } });
                }
                currentText = para;
            } else {
                currentText += (currentText ? '\n\n' : '') + para;
            }
        }
        if (currentText.trim()) {
            blocks.push({ type: 'section', text: { type: 'mrkdwn', text: currentText.trim() } });
        }

        // Slack allows max 50 blocks; use fallback text for notifications
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: message.substring(0, 200),
                blocks: blocks.slice(0, 50),
            }),
        });
        return res.ok;
    } catch (err) {
        console.error('Error sending Slack message:', err);
        return false;
    }
}

export async function sendNotification(
    config: VegaNotificationConfig,
    message: string,
    channels: string[]
): Promise<void> {
    const promises: Promise<boolean>[] = [];

    if (channels.includes('telegram') && config.telegramBotToken && config.telegramChatId) {
        promises.push(sendTelegramMessage(config.telegramBotToken, config.telegramChatId, message));
    }

    if (channels.includes('slack') && config.slackWebhookUrl) {
        promises.push(sendSlackMessage(config.slackWebhookUrl, message));
    }

    await Promise.allSettled(promises);
}
