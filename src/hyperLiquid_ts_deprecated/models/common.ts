export interface OrderResult {
    success: boolean;
    orderId?: string;
    stopLossOrderId?: string;
    dbOrderId?: string;
    message?: string;
    error?: string;
}

export interface AssetMeta {
    [symbol: string]: {
        szDecimals: number;
    };
}
