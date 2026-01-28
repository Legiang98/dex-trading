import { app, InvocationContext, Timer } from "@azure/functions";
import { listAllOpenOrders, updateOrder } from "../db/tableStorage.repository";
import { getEnvConfig, createClients } from "../helpers/hyperliquid.helpers";

/**
 * Periodically reconciles open trades in the database with actual orders on HyperLiquid.
 * If neither the entry order (oid) nor the stop-loss order (stopLossOid) exist on HL,
 * the trade is marked as 'closed' in the database.
 */
export async function reconcileTrades(myTimer: Timer, context: InvocationContext): Promise<void> {
    context.log("Reconciliation job started...");

    try {
        const { privateKey, userAddress, isTestnet } = getEnvConfig();
        const { infoClient } = createClients(privateKey, isTestnet);

        // Fetch all trades marked as 'open' in our database
        const dbOpenTrades = await listAllOpenOrders();
        if (dbOpenTrades.length === 0) {
            context.log("No open trades found in database. Finishing job.");
            return;
        }

        // Fetch all currently open orders from HyperLiquid API
        // This returns an array of all open orders across all symbols for the user
        const hlOpenOrders = await infoClient.openOrders({ user: userAddress as `0x${string}` });

        // Use a Set for O(1) order ID lookup
        const hlOpenOids = new Set(hlOpenOrders.map(o => o.oid.toString()));

        let reconciledCount = 0;

        for (const trade of dbOpenTrades) {
            const entryOidExists = trade.oid ? hlOpenOids.has(trade.oid.toString()) : false;
            const stopLossOidExists = trade.stopLossOid ? hlOpenOids.has(trade.stopLossOid.toString()) : false;

            // If neither the main order nor the stop loss are active, the trade is finished
            if (!entryOidExists && !stopLossOidExists) {
                context.log(`Reconciling orphaned trade: Symbol=${trade.symbol}, Strategy=${trade.strategy}, ID=${trade.id}`);

                await updateOrder(trade.id, {
                    status: 'closed'
                });

                reconciledCount++;
            }
        }

        context.log(`Reconciliation job finished. Total trades checked: ${dbOpenTrades.length}, Reconciled: ${reconciledCount}`);

    } catch (error) {
        context.error("Error during trade reconciliation:", error instanceof Error ? error.message : error);
    }
}

// Schedule: Runs every 6 hours (0 0 */6 * * *)
app.timer("reconcileTrades", {
    schedule: "0 0 */6 * * *",
    handler: reconcileTrades
});
