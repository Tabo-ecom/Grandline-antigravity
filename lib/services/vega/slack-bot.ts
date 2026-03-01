/**
 * Vega AI - Slack Bot (Web API)
 * Sends messages using Slack Bot token (not webhook).
 * Supports blocks for rich formatting.
 */

export async function sendSlackBotMessage(
    botToken: string,
    channelId: string,
    text: string,
    blocks?: any[],
): Promise<boolean> {
    try {
        const payload: any = {
            channel: channelId,
            text,
        };

        if (blocks && blocks.length > 0) {
            payload.blocks = blocks.slice(0, 50);
        }

        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${botToken}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        return data.ok === true;
    } catch (err) {
        console.error('[SlackBot] Error sending message:', err);
        return false;
    }
}

/** Build a confirmation message with action details */
export function buildConfirmationBlocks(
    entityName: string,
    action: string,
    detail: string,
): any[] {
    return [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `🤖 *VEGA — Confirmación*\n\n*${action}*: ${entityName}\n${detail}\n\n_Responde *SI* para confirmar o *NO* para cancelar._`,
            },
        },
    ];
}
