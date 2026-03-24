import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { webhookSchema } from "../validators/webhookSchema";
import { WebhookPayload } from "../models/webhook";
import { HTTP } from "../constants/http";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

/**
 * Gatekeeper Lambda
 * Fast validation and immediate push to SQS. Target < 200ms handshake.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return { statusCode: 400, body: JSON.stringify({ message: "No body provided" }) };
        }
        
        const body = JSON.parse(event.body);

        /** 
        * Step 1: Validate schema (Fast Joi validation)
        */
        const rawPayload = await webhookSchema.validateAsync(body, { abortEarly: false }) as WebhookPayload;

        /**
         * Step 2: Push to Queue for background processing (Instant SQS Push)
         */
        const queueUrl = process.env.SQS_QUEUE_URL;
        if (!queueUrl) throw new Error("SQS_QUEUE_URL not configured");

        await sqs.send(new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(rawPayload)
        }));

        /**
         * Step 3: Return success to TradingView (Prevents timeouts)
         */
        return {
            statusCode: HTTP.OK,
            body: JSON.stringify({ message: "Signal received and queued successfully." })
        };

    } catch (error: any) {
        console.error("Gatekeeper Error:", error);
        
        // Return 400 for validation errors or 500 for critical failures
        const isValidationError = error.isJoi || error.name === 'ValidationError';
        return {
            statusCode: isValidationError ? HTTP.BAD_REQUEST : 500,
            body: JSON.stringify({ error: error.message || "Internal Server Error" })
        };
    }
}
