import { WebhookPayload, ValidationResult } from "../types";
import * as hl from "@nktkas/hyperliquid";
import { InvocationContext } from "@azure/functions";
import { getOrder } from '../db/tableStorage.repository';

/**
 * Create a HyperLiquid InfoClient instance for API calls
 * @returns Configured InfoClient for testnet or mainnet based on environment
 */
function createInfoClient(): hl.InfoClient {
    return new hl.InfoClient({
        transport: new hl.HttpTransport({
            isTestnet: process.env.HYPERLIQUID_TESTNET === "true"
        })
    });
}

/**
 * Check if the user has an open position for the given symbol and strategy
 * Validates by checking database record and verifying order status on HyperLiquid
 * @param symbol - Trading symbol
 * @param strategy - Strategy name
 * @param userAddress - User's wallet address
 * @param context - Optional context for logging
 * @returns True if position exists and order is filled
 */
async function hasOpenPosition(
    symbol: string,
    strategy: string,
    userAddress: string,
    context?: any
): Promise<boolean> {
    try {
        const infoClient = createInfoClient();
        const openOrder = await getOrder({ symbol, strategy, status: "open" });
        if (!openOrder) {
            return false;
        }
        const openOrderOid = openOrder.oid;
        const orderStatus = await infoClient.orderStatus({ user: userAddress as `0x${string}`, oid: openOrderOid });
        // Type guard: check if response has order property
        if (orderStatus.status === "order") {
            return orderStatus.order.status === "filled";
        }

        console.log("Order not found or unknown status");
        return false;
    } catch (error) {
        console.error("Error checking position:", error);
        return false;
    }
}

/**
 * Validate if the symbol exists on HyperLiquid
 * @param symbol - Trading symbol to validate
 * @returns True if symbol exists in HyperLiquid universe
 */
async function isValidSymbol(symbol: string): Promise<boolean> {
    const infoClient = createInfoClient();
    const meta = await infoClient.meta();
    return meta.universe.some(asset => asset.name === symbol);
}

/**
 * Validate stop loss logic
 * For BUY orders: stop loss must be below entry price
 * For SELL orders: stop loss must be above entry price
 * @param payload - Webhook payload containing order details
 * @returns True if stop loss is valid for the order type
 */
function isValidStopLoss(payload: WebhookPayload): boolean {
    if (!payload.stopLoss) return false;
    const isBuy = payload.type === "BUY";
    return isBuy ? payload.stopLoss < payload.price : payload.stopLoss > payload.price;
}

/**
 * Check if the action is an entry action
 * @param action - Action type from webhook
 * @returns True if action is "ENTRY"
 */
function isEntryAction(action: string): boolean {
    return action === "ENTRY";
}

/**
 * Main signal validation function
 * Validates symbol existence, stop loss logic, and position status
 * @param payload - Webhook payload to validate
 * @param context - Optional Azure Function invocation context
 * @returns Validation result with isValid flag and optional reason/skipped status
 */
export async function validateSignal(
    payload: WebhookPayload,
    context?: InvocationContext
): Promise<ValidationResult> {
    try {
        // Symbol must exist
        if (!await isValidSymbol(payload.symbol)) {
            return { isValid: false, reason: `Invalid symbol: ${payload.symbol}` };
        }

        const userAddress = process.env.HYPERLIQUID_USER_ADDRESS;
        if (!userAddress) {
            return { isValid: true };
        }

        const hasPosition = await hasOpenPosition(payload.symbol, payload.strategy, userAddress);

        if (isEntryAction(payload.action) && hasPosition) {
            return {
                isValid: false,
                skipped: true,
                reason: `Already have open position for ${payload.symbol} with strategy ${payload.strategy}`
            };
        }

        // Stop loss must be valid for entry actions
        if (isEntryAction(payload.action) && !isValidStopLoss(payload)) {
            return { isValid: false, reason: `Invalid stop loss for ${payload.symbol}` };
        }

        // Prevent exit if no position for this strategy
        if (payload.action === "EXIT" && !hasPosition) {
            return {
                isValid: false,
                skipped: true,
                reason: `No open position found for ${payload.symbol} with strategy ${payload.strategy}`
            };
        }

        // All checks passed
        return { isValid: true };

    } catch (error) {
        // Catch-all for unexpected errors
        return {
            isValid: false,
            reason: error instanceof Error ? error.message : "Validation error"
        };
    }
}