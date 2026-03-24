import { WebhookPayload } from "../models/webhook";
import * as hl from "@nktkas/hyperliquid";
import { formatPrice } from "@nktkas/hyperliquid/utils";
import { AppError } from "../helpers/errorHandler";
import { HTTP } from "../constants/http";

/**
 * Normalize order size for HyperLiquid orders
 * @param symbol - The trading symbol
 * @param size - The original size
 * @param decimals - Number of decimal places supported by the exchange for this asset
 * @returns Normalized size
 */
function normalizeOrderSize(
    symbol: string,
    size: number,
    decimals: number
): number {
    const factor = Math.pow(10, decimals);
    return Math.floor(size * factor) / factor;
}


/**
 * Validate the stop loss price against liquidation price
 * @param order - Order direction ("buy" or "sell")
 * @param price - Entry price
 * @param currentLeverage - Current leverage value
 * @param positionSize - Size of the position
 * @param stopLossPrice - Proposed stop loss price
 * @returns True if stop loss is valid (above liquidation for buy, below for sell)
 */
function validateStoploss(
    order: "buy" | "sell",
    price: number,
    currentLeverage: number,
    positionSize: number,
    stopLossPrice: number,
): boolean {
    const margin = (price * positionSize) / currentLeverage;
    if (order === "buy") {
        const liquidationPrice = price - (margin / positionSize);
        return stopLossPrice > liquidationPrice;
    } else {
        const liquidationPrice = price + (margin / positionSize);
        return stopLossPrice < liquidationPrice;
    }
}



/**
 * Build order request from trading signal
 * Calculates position size based on fixed USD amount and validates stop loss
 * @param signal - Webhook payload containing trading signal
 * @param context - Optional Azure Function context for logging
 * @returns Enriched WebhookPayload with quantity and normalized prices
 */
export async function buildOrder(signal: WebhookPayload, context?: any): Promise<WebhookPayload> {

    /*
    * Input for the buildOrder function
    */
    const fixedUsdAmount = parseFloat(process.env.FIX_STOPLOSS || "3");
    const userAddress = process.env.HYPERLIQUID_USER_ADDRESS;

    if (!userAddress) {
        throw new AppError("HYPERLIQUID_USER_ADDRESS not configured", HTTP.INTERNAL_SERVER_ERROR);
    }

    /*
    * Initialize connection and info client
    */
    const transport = new hl.HttpTransport({
        isTestnet: process.env.HYPERLIQUID_TESTNET === "true"
    });
    const infoClient = new hl.InfoClient({ transport });

    /* Parallelize data fetching */
    const [allMids, assetData, metaResponse] = await Promise.all([
        infoClient.allMids(),
        infoClient.activeAssetData({
            user: userAddress as `0x${string}`,
            coin: signal.symbol
        }),
        infoClient.meta()
    ]);

    const marketPrice = parseFloat(allMids[signal.symbol] || "0");

    if (!marketPrice) {
        throw new AppError(`Unable to fetch market price for ${signal.symbol}`, HTTP.BAD_REQUEST);
    }

    /*
    *  e.g; Leverage for BTC: { type: 'isolated', value: 8, rawUsd: '-207.59043' }
    */
    const leverage = assetData.leverage;
    const exchangeClient = new hl.ExchangeClient({
        wallet: process.env.HYPERLIQUID_PRIVATE_KEY!,
        transport
    });

    /**
    * Find asset ID and szDecimals
    */
    const assetIndex = metaResponse.universe.findIndex(asset => asset.name === signal.symbol);

    if (assetIndex === -1) {
        throw new AppError(`Symbol ${signal.symbol} not found in HyperLiquid`, HTTP.BAD_REQUEST);
    }

    const assetMeta = metaResponse.universe[assetIndex];
    const szDecimalsSymbol = assetMeta.szDecimals;

    /* Switch to isolated mode if current leverage is cross (Don't await to save time, or do it only if needed) */
    if (leverage.type == "cross") {
        await exchangeClient.updateLeverage({
            isCross: false,
            asset: assetIndex,
            leverage: leverage.value
        });
    }

    // Ensure stopLoss is a number for calculations
    const stopLossPrice = typeof signal.stopLoss === 'string' ? parseFloat(signal.stopLoss) : signal.stopLoss!;

    const rawSize = fixedUsdAmount / Math.abs(marketPrice - stopLossPrice);
    const normalizedQuantity = normalizeOrderSize(signal.symbol, rawSize, szDecimalsSymbol);
    const positionValue = normalizedQuantity * marketPrice;
    /**
     * Format prices using official SDK function
     * - Handles up to 5 significant figures
     * - Max decimal places: 6 - szDecimals (for perpetuals)
     * - Returns string to preserve precision
     */
    const normalizedPrice = formatPrice(marketPrice, szDecimalsSymbol);
    const normalizedStopLoss = formatPrice(stopLossPrice, szDecimalsSymbol);

    /*
    * Validate stop loss with liquidation price
    */
    const order: "buy" | "sell" = signal.type === "BUY" ? "buy" : "sell";
    const isStoplossValid = validateStoploss(
        order,
        marketPrice,
        leverage.value,
        normalizedQuantity,
        stopLossPrice
    );

    if (!isStoplossValid) {
        throw new AppError(`Invalid stop loss price ${signal.stopLoss} for ${signal.symbol} with current leverage ${leverage.value}`, HTTP.BAD_REQUEST);
    }

    // Return enriched WebhookPayload with calculated quantity and normalized prices
    return {
        ...signal,
        quantity: normalizedQuantity,
        price: normalizedPrice,
        stopLoss: normalizedStopLoss,
        positionValue,
    };
}
