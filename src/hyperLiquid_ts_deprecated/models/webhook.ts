export interface WebhookPayload {
    symbol: string;
    action: string;
    type: string;
    price: number | string;
    stopLoss?: number | string;
    strategy: string;
    orderId?: string;
    quantity?: number;
    positionValue?: number;
}

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    skipped?: boolean;
}
