import { app, InvocationContext } from "@azure/functions";
import { services } from "../services/index";
import { WebhookPayload } from "../types";

const {
    parseWebhook,
    validateSignal,
    buildOrder,
    executeOrder,
    closeOrder
} = services;

/**
 * Queue-triggered function to process trade signals in the background.
 * This ensures the HTTP request to TradingView can return 200 OK immediately,
 * avoiding timeouts.
 */
export async function processTrade(
    message: string,
    context: InvocationContext
): Promise<void> {
    try {
        context.log(`Processing trade signal from queue: ${message}`);
        const rawPayload = JSON.parse(message) as WebhookPayload;
        
        const payload = parseWebhook(rawPayload);
        const validation = await validateSignal(payload, context);
        context.log("Validation Result:", validation);

        if (!validation.isValid) {
            context.log(`Validation skipped: ${validation.reason}`);
            return;
        }

        let orderResult: any;
        switch (payload.action.toUpperCase()) {
            case "ENTRY":
                const tradeOrder = await buildOrder(payload, context);
                context.log("Built Order Request:", tradeOrder);
                orderResult = await executeOrder(tradeOrder, context);
                context.log("Execute Order: ", JSON.stringify(orderResult));
                break;

            case "EXIT":
                orderResult = await closeOrder(payload, context);
                context.log("Close Order: ", JSON.stringify(orderResult));
                break;

            default:
                context.log(`Unknown action in queue: ${payload.action}`);
                return;
        }

        // Log the final result using the centralized service
        await services.logTrade(payload, orderResult, context);

    } catch (error) {
        context.error(`Fatal error in background trade processing:`, error);
    }
}

app.storageQueue("processTrade", {
    queueName: "trade-signals",
    connection: "AzureWebJobsStorage", // Uses your existing storage account
    handler: processTrade
});
