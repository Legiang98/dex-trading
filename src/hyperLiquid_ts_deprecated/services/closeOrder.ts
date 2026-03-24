import { WebhookPayload, OrderResult } from "../models/webhook";
import * as hl from "@nktkas/hyperliquid";
import { formatPrice } from "@nktkas/hyperliquid/utils";
import { updateOrder } from "../repositories/dynamo.repository";
import { AppError } from "../helpers/errorHandler";
import { HTTP } from "../constants/http";
import { sendNotification } from "../helpers/telegram";
import { getMarketPrice } from "../helpers/marketPrice.helpers";

import {
    getEnvConfig,
    createClients,
    getAssetInfo,
    getStrategyPosition,
    getOrderPnl,
    extractOrderId
} from "../helpers/hyperliquid.helpers";
/**
 * Cancel all open orders for a symbol (including stop loss)
 * @param exchangeClient - HyperLiquid exchange client
 * @param infoClient - HyperLiquid info client
 * @param userAddress - User's wallet address
 * @param symbol - Trading symbol
 * @param assetId - Asset ID from HyperLiquid meta data
 */
async function cancelOpenOrders(
    exchangeClient: hl.ExchangeClient,
    infoClient: hl.InfoClient,
    userAddress: string,
    symbol: string,
    assetId: number
): Promise<void> {
    const openOrders = await infoClient.openOrders({ user: userAddress as `0x${string}` });
    const ordersToCancel = openOrders.filter(order => order.coin === symbol);

    if (ordersToCancel.length > 0) {
        await exchangeClient.cancel({
            cancels: ordersToCancel.map(order => ({
                a: assetId,
                o: order.oid
            }))
        });
        console.log(`Cancelled ${ordersToCancel.length} open orders for ${symbol}`);
    }
}

/**
 * Close an open position by placing a limit order at near-market price
 * Cancels all open orders, calculates PnL, and sends notification
 * @param signal - Webhook payload containing EXIT signal
 * @param context - Optional Azure Function context for logging
 * @returns Order result with success status and message
 */
export async function closeOrder(
    signal: WebhookPayload,
    context?: any
): Promise<OrderResult> {
    try {
        console.log(`[closeOrder] Received signal:`, JSON.stringify(signal, null, 2));

        const { privateKey, userAddress, isTestnet } = getEnvConfig();
        const { exchangeClient, infoClient } = createClients(privateKey, isTestnet);
        const { assetInfo, assetId } = await getAssetInfo(infoClient, signal.symbol);

        // Get current position from HyperLiquid and Database
        const { strategyPosition, isBuy, id, oid } = await getStrategyPosition(infoClient, userAddress, signal.symbol, signal.strategy);

        // Get near-market price for quick execution
        const closePrice = await getMarketPrice(infoClient, signal.symbol, isBuy);
        const marketPrice = formatPrice(closePrice, assetInfo.szDecimals);

        const closeResponse = await exchangeClient.order({
            orders: [{
                a: assetId,
                b: !isBuy, // Opposite of current position
                p: marketPrice,
                s: strategyPosition,
                r: true, // Reduce-only to ensure it only closes position
                t: { limit: { tif: "Gtc" } } // Good-til-cancel to ensure full position closure
            }],
            grouping: "na"
        });

        const orderStatus = closeResponse.response.data.statuses[0];
        const closeOrderId = extractOrderId(orderStatus);
        if ('error' in orderStatus) {
            throw new AppError(`Failed to close position: ${orderStatus.error}`, HTTP.BAD_REQUEST);
        }

        const pnlData = await getOrderPnl(infoClient, userAddress, oid);
        await updateOrder(id, {
            status: 'closed',
            pnl: pnlData.netPnl,
            stopLossOid: closeOrderId.toString()
        });

        await sendNotification(
            "Order Closed",
            signal.symbol,
            isBuy,
            signal.price,
            signal.stopLoss,
            signal.positionValue
        );

        return {
            success: true,
            message: `Closed ${signal.symbol} position`,
            orderId: oid.toString(),
            stopLossOrderId: closeOrderId.toString(),
            dbOrderId: id
        };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}