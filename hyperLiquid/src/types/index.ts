/**
 * Type definitions for HyperLiquid trading webhook
 */

/**
 * @typedef {Object} WebhookPayload
 * @property {string} symbol
 * @property {"ENTRY"|"EXIT"|"UPDATE_STOP"} action
 * @property {"BUY"|"SELL"} type
 * @property {number} price
 * @property {number} stopLoss
 *
 * @example
 * {
 *   "symbol": "BTC",
 *   "action": "ENTRY",
 *   "type": "BUY",
 *   "price": 95000,
 *   "stopLoss": 94000
 * }
 */
export interface WebhookPayload {
    symbol: string;
    action: string;
    type: string;
    price: number | string; // number from webhook, string after formatPrice
    stopLoss?: number | string; // number from webhook, string after formatPrice
    strategy: string;
    orderId?: string;
    quantity?: number; // Calculated by buildOrder
    positionValue?: number; // Calculated by buildOrder
}

export interface OrderResult {
    success: boolean;
    orderId?: string;
    stopLossOrderId?: string;
    dbOrderId?: string;
    message?: string;
    error?: string;
}

// export interface trailingStoploss {
//     symbol: string;
//     action: "EXIT";
//     type: "BUY" | "SELL";
//     stopLoss?: number;
//     strategy: string;
// }

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    skipped?: boolean;
}

export interface AssetMeta {
    [symbol: string]: {
        szDecimals: number;
    };
}