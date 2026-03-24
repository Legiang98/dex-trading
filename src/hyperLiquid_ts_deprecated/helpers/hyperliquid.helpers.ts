import * as hl from "@nktkas/hyperliquid";
import { AppError } from "./errorHandler";
import { HTTP } from "../constants/http";
import { getOrder } from "../repositories/dynamo.repository";

/**
 * Get environment configuration for HyperLiquid
 * @returns Private key, user address, and testnet flag
 */
export function getEnvConfig() {
    const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
    const userAddress = process.env.HYPERLIQUID_USER_ADDRESS;
    const isTestnet = process.env.HYPERLIQUID_TESTNET === "true";

    if (!privateKey) throw new Error("HYPERLIQUID_PRIVATE_KEY not configured");
    if (!userAddress) throw new Error("HYPERLIQUID_USER_ADDRESS not configured");

    return { privateKey, userAddress, isTestnet };
}

/**
 * Extract order ID from HyperLiquid order status response
 * @param status - Order status response from HyperLiquid API
 * @returns Order ID (OID)
 * @throws AppError if order ID cannot be extracted
 */
export function extractOrderId(status: any): number {
    if (!status) throw new AppError("Order status is missing", HTTP.BAD_REQUEST);

    if (status.resting?.oid) return status.resting.oid;
    if (status.filled?.oid) return status.filled.oid;

    throw new AppError("Order ID not found in response", HTTP.BAD_REQUEST);
}

/**
 * Create HyperLiquid API clients
 * @param privateKey - Wallet private key
 * @param isTestnet - Whether to use testnet
 * @returns Exchange and info clients
 */
export function createClients(privateKey: string, isTestnet: boolean) {
    const transport = new hl.HttpTransport({ isTestnet });
    return {
        exchangeClient: new hl.ExchangeClient({ wallet: privateKey, transport }),
        infoClient: new hl.InfoClient({ transport })
    };
}

/**
 * Get asset metadata from HyperLiquid
 * @param infoClient - HyperLiquid InfoClient
 * @param symbol - Trading symbol
 * @returns Asset info and asset ID
 */
export async function getAssetInfo(infoClient: hl.InfoClient, symbol: string) {
    const meta = await infoClient.meta();
    const assetInfo = meta.universe.find(asset => asset.name === symbol);

    if (!assetInfo) {
        throw new AppError(`Asset ${symbol} not found`, HTTP.BAD_REQUEST);
    }

    return {
        assetInfo,
        assetId: meta.universe.indexOf(assetInfo)
    };
}

/**
 * Get user's current position and validate against database order
 * @param infoClient - HyperLiquid InfoClient
 * @param userAddress - User's wallet address
 * @param symbol - Trading symbol
 * @param strategy - Strategy name
 * @returns Strategy position size, direction, and partition key
 */
export async function getStrategyPosition(
    infoClient: hl.InfoClient,
    userAddress: string,
    symbol: string,
    strategy: string
) {
    const userData = await infoClient.webData2({ user: userAddress as `0x${string}` });
    const positionData = userData.clearinghouseState.assetPositions.find(
        pos => pos.position.coin === symbol
    );

    if (!positionData) {
        throw new AppError(`No open position found for ${symbol}`, HTTP.BAD_REQUEST);
    }

    const openOrder = await getOrder({ symbol, strategy, status: "open" });
    if (!openOrder) {
        throw new AppError(`No open order found for ${symbol}/${strategy}`, HTTP.BAD_REQUEST);
    }
    console.log("Order id", openOrder.oid);
    const strategyPosition = openOrder.quantity;
    const isBuy = openOrder.order_type === "BUY";
    const id = openOrder.id;
    const oid = openOrder.oid;

    const fullPosition = Math.abs(parseFloat(positionData.position.szi));
    if (fullPosition < strategyPosition) {
        throw new AppError(
            `Position size (${fullPosition}) is less than order size (${strategyPosition})`,
            HTTP.BAD_REQUEST
        );
    }

    return { strategyPosition, isBuy, id, oid };
}

/**
 * Get PnL from an order by fetching its fills
 * @param infoClient - HyperLiquid InfoClient
 * @param userAddress - User's wallet address
 * @param oid - Order ID from HyperLiquid
 * @returns PnL and fees from the order
 */
export async function getOrderPnl(
    infoClient: hl.InfoClient,
    userAddress: string,
    oid: string
): Promise<{ totalPnl: number; totalFees: number; netPnl: number; trades: any[] }> {
    try {
        const userFills = await infoClient.userFills({ user: userAddress as `0x${string}` });

        const orderTrades = userFills.filter(fill =>
            fill.oid.toString() === oid
        );

        if (orderTrades.length === 0) {
            return { totalPnl: 0, totalFees: 0, netPnl: 0, trades: [] };
        }

        let totalPnl = 0;
        let totalFees = 0;

        for (const trade of orderTrades) {
            const pnl = parseFloat(trade.closedPnl || '0');
            const fee = Math.abs(parseFloat(trade.fee || '0'));

            totalPnl += pnl;
            totalFees += fee;
        }

        const netPnl = totalPnl - totalFees;

        return {
            totalPnl,
            totalFees,
            netPnl,
            trades: orderTrades
        };

    } catch (error) {
        console.error('[getOrderPnl] Error fetching order PnL:', error);
        throw error;
    }
}
