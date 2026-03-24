import { parseWebhook } from './parseWebhook';
import { validateSignal } from './validateSignal';
import { buildOrder } from './buildOrder';
import { executeOrder } from './executeOrder';
import { logTrade } from './logTrade';
import { closeOrder } from './closeOrder';

export const services = {
    parseWebhook,
    validateSignal,
    buildOrder,
    executeOrder,
    logTrade,
    closeOrder,
}

/**
 * Export individual services for direct imports if needed
 */
export { parseWebhook, validateSignal, buildOrder, executeOrder, logTrade, closeOrder };

/**
 * Export types
 */
export type { WebhookPayload, ValidationResult, OrderResult } from '../models/webhook';