import { app, HttpRequest, HttpResponseInit, InvocationContext, output } from "@azure/functions";
import { webhookSchema } from "../validators/webhookSchema";
import { WebhookPayload } from "../types";
import { HTTP } from "../constants/http";
import { httpResponse } from "../helpers/httpResponse";
import { handleError } from "../helpers/errorHandler";

const queueOutput = output.storageQueue({
    queueName: "trade-signals",
    connection: "AzureWebJobsStorage"
});

async function hyperLiquidWebhook(
    request: HttpRequest,
    context: InvocationContext
): Promise<HttpResponseInit> {
    try {
        const body = await request.json();

        /** 
        * Step 1: Validate schema (Fast)
        */
        const rawPayload = await webhookSchema.validateAsync(body, { abortEarly: false }) as WebhookPayload;

        /**
         * Step 2: Push to Queue for background processing (Instant)
         */
        context.extraOutputs.set(queueOutput, JSON.stringify(rawPayload));

        /**
         * Step 3: Return success to TradingView (Prevents timeouts)
         */
        return httpResponse(HTTP.OK, "Signal received and queued successfully.");

    } catch (error) {
        return await handleError(error as Error, context);
    }
}

app.http("hyperLiquidWebhook", {
    methods: ["POST"],
    authLevel: "function",
    extraOutputs: [queueOutput],
    handler: hyperLiquidWebhook
});
