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

        const { privateKey, userAddress, isTestnet } = getEnvConfig();
        const { exchangeClient, infoClient } = createClients(privateKey, isTestnet);
        const { assetInfo, assetId } = await getAssetInfo(infoClient, signal.symbol);

        const szDecimals = assetInfo.szDecimals;
        const size = signal.quantity.toFixed(szDecimals);
        const isBuy = signal.type === "BUY";

        // Use the already-formatted price from buildOrder (formatted with SDK's formatPrice)
        // signal.price is already a string formatted according to HyperLiquid's rules
        const formattedPrice = signal.price.toString();

        // Place main order at the formatted price
        const orderResponse = await exchangeClient.order({
            orders: [{
                a: assetId,
                b: isBuy,
                p: formattedPrice,
                s: size,
                r: false,
                t: { limit: { tif: "Gtc" } }
            }],
            grouping: "na"
        });

        const orderStatus = orderResponse.response.data.statuses[0];
        const orderId = extractOrderId(orderStatus);

        let stopLossOid: string | undefined;

        // Place stop loss order if specified
        if (signal.stopLoss) {
            const stopLossResponse = await exchangeClient.order({
                orders: [{
                    a: assetId,
                    b: !isBuy,
                    p: signal.stopLoss.toString(),
                    s: size,
                    r: true,
                    t: {
                        trigger: {
                            isMarket: true,
                            triggerPx: signal.stopLoss.toString(),
                            tpsl: "sl"
                        }
                    }
                }],
                grouping: "na"
            });

            const stopLossStatus = stopLossResponse.response.data.statuses[0];
            stopLossOid = extractOrderId(stopLossStatus).toString();
        }

        // Insert single order record with stop loss info
        const dbOrder = await insertOrder({
            user_address: userAddress,
            symbol: signal.symbol,
            strategy: signal.strategy,
            quantity: signal.quantity,
            order_type: signal.type,
            price: signal.price,
            oid: orderId.toString(),
            stopLossOid: stopLossOid,
            stopLossPrice: signal.stopLoss,
            status: "open"
        });

        await sendNotification(
            "Order Executed",
            signal.symbol,
            isBuy,
            signal.price,
            signal.stopLoss,
            signal.positionValue
        );

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
