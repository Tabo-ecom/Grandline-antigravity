/**
 * Vega AI - Notification Service (Telegram + Slack)
 */

import { getAppData, setAppData } from '@/lib/firebase/firestore';
import type { VegaNotificationConfig } from '@/lib/types/vega';

const CONFIG_KEY = 'vega_notification_config';

export async function getNotificationConfig(userId: string): Promise<VegaNotificationConfig> {
    if (!userId) return { telegramBotToken: '', telegramChatId: '', slackWebhookUrl: '' };
    return (await getAppData<VegaNotificationConfig>(CONFIG_KEY, userId)) || {
        telegramBotToken: '',
        telegramChatId: '',
        slackWebhookUrl: '',
    };
}

export async function saveNotificationConfig(config: VegaNotificationConfig, userEmail: string): Promise<void> {
    await setAppData(CONFIG_KEY, config, userEmail);
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
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message }),
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
