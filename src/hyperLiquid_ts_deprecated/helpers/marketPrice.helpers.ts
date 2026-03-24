import * as hl from "@nktkas/hyperliquid";
import { AppError } from "./errorHandler";
import { HTTP } from "../constants/http";

/**
 * Get current market price (best bid/ask) for near-market execution
 * @param infoClient - HyperLiquid info client
 * @param symbol - Trading symbol (e.g., "BTC")
 * @param isBuy - True for buy orders, false for sell orders
 * @returns Adjusted market price for quick execution
 */
export async function getMarketPrice(
    infoClient: hl.InfoClient,
    symbol: string,
    isBuy: boolean
): Promise<number> {
    const allMids = await infoClient.allMids();
    const marketPrice = parseFloat(allMids[symbol] || "0");

    if (!marketPrice || isNaN(marketPrice)) {
        throw new AppError(`Unable to fetch market price for ${symbol}`, HTTP.BAD_REQUEST);
    }

    // For buy orders, price slightly above mid; for sell orders, slightly below
    // This ensures quick execution while avoiding market order restrictions
    const priceAdjustment = isBuy ? 1.001 : 0.999;
    return marketPrice * priceAdjustment;
}

/**
 * Format price according to HyperLiquid requirements
 * @param price - Raw price to format
 * @param szDecimals - Size decimals from asset info
 * @returns Formatted price string with proper decimal places
 */
export function formatPriceForOrder(price: number, szDecimals: number): string {
    const MAX_DECIMALS = 5;
    const pxDecimals = Math.max(0, MAX_DECIMALS - Math.floor(Math.log10(price)) - 1);
    return price.toFixed(Math.min(pxDecimals, szDecimals));
}

/**
 * Get and format market price in one step (convenience function)
 * @param infoClient - HyperLiquid info client
 * @param symbol - Trading symbol (e.g., "BTC")
 * @param isBuy - True for buy orders, false for sell orders
 * @param szDecimals - Size decimals from asset info
 * @returns Formatted market price ready for order placement
 */
export async function getFormattedMarketPrice(
    infoClient: hl.InfoClient,
    symbol: string,
    isBuy: boolean,
    szDecimals: number
): Promise<string> {
    const marketPrice = await getMarketPrice(infoClient, symbol, isBuy);
    return formatPriceForOrder(marketPrice, szDecimals);
}
