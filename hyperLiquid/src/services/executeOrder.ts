import { OrderResult, WebhookPayload } from "../types";
import * as hl from "@nktkas/hyperliquid";
import { insertOrder } from "../db/tableStorage.repository";
import { getEnvConfig, createClients, getAssetInfo, extractOrderId } from "../helpers/hyperliquid.helpers";
import { AppError } from "../helpers/errorHandler";
import { HTTP } from "../constants/http";
import { sendNotification } from "../helpers/telegram";

/**
 * Execute order on HyperLiquid exchange
 * Places main order and optional stop loss, then stores in database
 * @param signal - Webhook payload with order details (must include quantity from buildOrder)
 * @param context - Optional Azure Function context for logging
 * @returns Order result with success status, message, and order IDs
 */
export async function executeOrder(
    signal: WebhookPayload,
    context?: any
): Promise<OrderResult> {
    try {
        if (!signal.quantity) {
            throw new AppError("Quantity is required. Did you call buildOrder first?", HTTP.BAD_REQUEST);
        }

        const { privateKey, isTestnet, userAddress } = getEnvConfig();
        const { exchangeClient, infoClient } = createClients(privateKey, isTestnet);
        const { assetId } = await getAssetInfo(infoClient, signal.symbol);

        const isBuy = signal.type === "BUY";
        const size = signal.quantity.toString();

        // 1. Prepare Batched Orders (Main Entry + Stop Loss)
        const orders: any[] = [{
            a: assetId,
            b: isBuy,
            p: signal.price.toString(),
            s: size,
            r: false,
            t: { limit: { tif: "Gtc" } }
        }];

        if (signal.stopLoss) {
            orders.push({
                a: assetId,
                b: !isBuy,
                p: signal.stopLoss.toString(),
                s: size,
                r: true, // Reduce only
                t: {
                    trigger: {
                        isMarket: true,
                        triggerPx: signal.stopLoss.toString(),
                        tpsl: "sl"
                    }
                }
            });
        }

        // 2. Execute Batch Order (Single Network Call)
        const orderResponse = await exchangeClient.order({
            orders: orders,
            grouping: "na"
        });

        const statuses = orderResponse.response.data.statuses;
        const mainOrderStatus = statuses[0];
        const orderId = extractOrderId(mainOrderStatus);

        let stopLossOid: string | undefined;
        if (signal.stopLoss && statuses[1]) {
            stopLossOid = extractOrderId(statuses[1]).toString();
        }

        // 3. Database & Notifications (Parallel/Non-blocking)
        const dbPromise = insertOrder({
            user_address: userAddress,
            symbol: signal.symbol,
            strategy: signal.strategy,
            quantity: signal.quantity,
            order_type: signal.type,
            price: signal.price as number,
            oid: orderId.toString(),
            stopLossOid: stopLossOid,
            stopLossPrice: signal.stopLoss as number,
            status: "open"
        });

        // Fire and forget Telegram notification to save time
        sendNotification(
            "Order Executed",
            signal.symbol,
            isBuy,
            signal.price,
            signal.stopLoss,
            signal.positionValue
        ).catch(err => console.error("Notification failed:", err));

        const dbOrder = await dbPromise;

        return {
            success: true,
            message: `Order placed successfully for ${signal.symbol}`,
            orderId: orderId.toString(),
            stopLossOrderId: stopLossOid,
            dbOrderId: dbOrder.id
        };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
