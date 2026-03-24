export async function sendTelegramMessage(chatId: string, token: string, message: string): Promise<void> {
    try {
        console.log("Sending Telegram message:", message);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: message }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (err) {
        console.error("Failed to send Telegram message:", err);
    }
}

/**
 * Send trading notification with automatic message formatting
 * @param title - Notification title
 * @param symbol - Trading symbol
 * @param isBuy - Whether it's a buy order
 * @param price - Order price (accepts number or string)
 * @param stopLoss - Stop loss price (optional, accepts number or string)
 * @param pnl - PnL data (optional)
 * @param positionValue - Position value (optional)
 */
export async function sendNotification(
    title: string,
    symbol: string,
    isBuy: boolean,
    price: number | string,
    stopLoss?: number | string,
    positionValue?: number,
    pnl?: { netPnl: number; totalFees: number },
): Promise<void> {
    const isEnabled = process.env.TELEGRAM_ENABLED === 'true';

    if (!isEnabled) {
        console.log("Telegram notifications disabled");
        return;
    }

    const chatId = process.env.TELEGRAM_CHAT_ID;
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!chatId || !token) {
        console.log("Telegram credentials not configured, skipping notification");
        return;
    }

    const priceNum = typeof price === 'string' ? parseFloat(price) : price;
    const stopLossNum = stopLoss ? (typeof stopLoss === 'string' ? parseFloat(stopLoss) : stopLoss) : undefined;

    const action = isBuy ? "🟢 BUY" : "🔴 SELL";
    let message = `${title}\n${action} ${symbol} @ ${priceNum}`;

    if (positionValue) {
        message += `\n💵 Position Value: $${positionValue.toFixed(2)}`;
    }

    if (stopLossNum) {
        message += `\nSL: ${stopLossNum}`;
    }

    if (pnl) {
        const pnlEmoji = pnl.netPnl >= 0 ? "💰" : "📉";
        message += `\n\n${pnlEmoji} Net PnL: $${pnl.netPnl.toFixed(2)}`;
        message += `\n💸 Fees: $${pnl.totalFees.toFixed(2)}`;
    }

    try {
        await sendTelegramMessage(chatId, token, message);
    } catch (error) {
        console.error("Failed to send notification:", error);
    }
}
