import { listAllOpenOrders, updateOrder } from "../repositories/dynamo.repository";
import { getEnvConfig, createClients } from "../helpers/hyperliquid.helpers";

/**
 * EventBridge-triggered Lambda to periodically reconcile open trades.
 * Runs every 6 hours to find trades closed outside of our webhook.
 */
export const handler = async (event: any, context: any): Promise<void> => {
    console.log("Reconciliation job started...");

    try {
        const { privateKey, userAddress, isTestnet } = getEnvConfig();
        const { infoClient } = createClients(privateKey, isTestnet);

        // Fetch all trades marked as 'open' in our database
        const dbOpenTrades = await listAllOpenOrders();
        if (dbOpenTrades.length === 0) {
            console.log("No open trades found in database. Finishing job.");
            return;
        }

        // Fetch all currently open orders from HyperLiquid API
        const hlOpenOrders = await infoClient.openOrders({ user: userAddress as `0x${string}` });

        // Use a Set for O(1) order ID lookup
        const hlOpenOids = new Set(hlOpenOrders.map(o => o.oid.toString()));

        let reconciledCount = 0;

        for (const trade of dbOpenTrades) {
            const entryOidExists = trade.oid ? hlOpenOids.has(trade.oid.toString()) : false;
            const stopLossOidExists = trade.stopLossOid ? hlOpenOids.has(trade.stopLossOid.toString()) : false;

            // If neither the main order nor the stop loss are active, the trade is finished
            if (!entryOidExists && !stopLossOidExists) {
                console.log(`Reconciling orphaned trade: Symbol=${trade.symbol}, Strategy=${trade.strategy}, ID=${trade.id}`);

                await updateOrder(trade.id, {
                    status: 'closed'
                });

                reconciledCount++;
            }
        }

        console.log(`Reconciliation job finished. Total trades checked: ${dbOpenTrades.length}, Reconciled: ${reconciledCount}`);

    } catch (error) {
        console.error("Error during trade reconciliation:", error instanceof Error ? error.message : error);
        throw error;
    }
}
