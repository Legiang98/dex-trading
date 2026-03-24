import { WebhookPayload } from "../models/webhook";

/**
 * Parse and normalize webhook payload
 * Removes "USDT" suffix from symbol names to match HyperLiquid format
 * @param payload - Raw webhook payload from TradingView
 * @returns Normalized webhook payload with cleaned symbol name
 */
export function parseWebhook(payload: WebhookPayload): WebhookPayload {
    return {
        ...payload,
        symbol: payload.symbol.replace("USDT", "")
        // symbol: payload.symbol.replace("USDT", "").replace("USD", "")
    };
}
