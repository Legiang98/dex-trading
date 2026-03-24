import { SQSEvent, Context } from "aws-lambda";
import { services } from "../services/index";
import { WebhookPayload } from "../models/webhook";

const {
    parseWebhook,
    validateSignal,
    buildOrder,
    executeOrder,
    closeOrder
} = services;

/**
 * SQS-triggered Lambda to process trade signals.
 */
export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
    try {
        console.log(`Processing ${event.Records.length} trade signals from SQS`);
        
        for (const record of event.Records) {
            const message = record.body;
            console.log("Raw SQS message:", message);
            const rawPayload = JSON.parse(message) as WebhookPayload;
            
            const payload = parseWebhook(rawPayload);
            
            // Context shim to maintain compatibility with existing Azure functions logs if relying on them inside services
            const mockContext = { 
                log: console.log, 
                error: console.error 
            };

            const validation = await validateSignal(payload, mockContext);
            console.log("Validation Result:", validation);

            if (!validation.isValid) {
                console.log(`Validation skipped: ${validation.reason}`);
                continue;
            }

            let orderResult: any;
            switch (payload.action.toUpperCase()) {
                case "ENTRY":
                    const tradeOrder = await buildOrder(payload, mockContext);
                    console.log("Built Order Request:", tradeOrder);
                    
                    // Uses core executeOrder logic preserving HL inputs
                    orderResult = await executeOrder(tradeOrder, mockContext);
                    console.log("Execute Order: ", JSON.stringify(orderResult));
                    break;

                case "EXIT":
                    orderResult = await closeOrder(payload, mockContext);
                    console.log("Close Order: ", JSON.stringify(orderResult));
                    break;

                default:
                    console.log(`Unknown action in queue: ${payload.action}`);
                    continue;
            }

            // Centralized tracking/logging mechanism
            await services.logTrade(payload, orderResult, mockContext);
        }
    } catch (error) {
        console.error(`Fatal error in background trade processing:`, error);
        throw error; // Will automatically let SQS handle dead letter DLQ/retries
    }
}
