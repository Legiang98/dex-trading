import { TableClient, TableEntity, AzureNamedKeyCredential } from "@azure/data-tables";
import { OrderRecord, NewOrder } from '../types/order';

// Initialize Table Client
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
}

const tableName = process.env.TABLE_NAME || "orders";
const tableClient = TableClient.fromConnectionString(connectionString, tableName);

// ============================================================================
// HELPER FUNCTIONS - Internal utilities
// ============================================================================

/**
 * Convert NewOrder to Azure Table Storage entity
 * @param order - Order data to convert
 * @param id - Unique identifier (UUID) for the row key
 * @returns Table entity ready for storage
 */
function orderToEntity(order: NewOrder, id: string): TableEntity {
    const partitionKey = `${order.symbol}_${order.strategy}`;
    const rowKey = id;

    return {
        partitionKey,
        rowKey,
        userAddress: order.user_address,
        symbol: order.symbol,
        strategy: order.strategy,
        quantity: order.quantity.toString(),
        orderType: order.order_type,
        price: order.price.toString(),
        oid: order.oid,
        stopLossOid: order.stopLossOid || '',
        stopLossPrice: order.stopLossPrice ? order.stopLossPrice.toString() : '',
        pnl: '',
        status: order.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Convert Azure Table Storage entity to OrderRecord
 * @param entity - Table entity from Azure Storage
 * @returns Typed OrderRecord object
 */
function entityToOrder(entity: any): OrderRecord {
    return {
        partitionKey: entity.partitionKey as string,
        id: entity.rowKey as string,
        user_address: entity.userAddress as string,
        symbol: entity.symbol as string,
        strategy: entity.strategy as string,
        quantity: parseFloat(entity.quantity as string),
        order_type: entity.orderType as string,
        price: parseFloat(entity.price as string),
        oid: entity.oid as string,
        stopLossOid: entity.stopLossOid as string || undefined,
        stopLossPrice: entity.stopLossPrice ? parseFloat(entity.stopLossPrice as string) : undefined,
        pnl: entity.pnl ? parseFloat(entity.pnl as string) : undefined,
        status: entity.status as string,
        created_at: new Date(entity.createdAt as string),
        updated_at: new Date(entity.updatedAt as string),
    };
}

// ============================================================================
// PUBLIC API - Main Functions (ordered by typical workflow)
// ============================================================================

/**
 * Insert a new order into the database
 * Generates UUID for row key and creates partition key from symbol and strategy
 * @param order - New order data to insert
 * @returns Created order record with generated ID
 */
export async function insertOrder(order: NewOrder): Promise<OrderRecord> {
    try {
        const id = crypto.randomUUID();
        const entity = orderToEntity(order, id);

        await tableClient.createEntity(entity);

        return entityToOrder(entity);
    } catch (error) {
        console.error('Error inserting order:', error);
        throw error;
    }
}

/**
 * Build filter string from array of conditions
 * @param filters - Array of filter conditions
 * @returns Combined filter string
 */
function buildFilter(filters: string[]): string {
    if (filters.length === 0) {
        throw new Error("At least one filter must be provided");
    }
    return filters.join(" and ");
}

/**
 * Find an open order by symbol and strategy
 * Uses efficient query filtering on symbol, strategy, and status
 * @param options - Query options
 * @returns First matching open order or null if none found
 */
export async function getOrder(options: {
    symbol?: string;
    strategy?: string;
    id?: string;
    status?: string;
}): Promise<OrderRecord | null> {

    const filters: string[] = [];

    if (options.id) {
        filters.push(`RowKey eq '${options.id}'`);
    }

    if (options.symbol) {
        filters.push(`symbol eq '${options.symbol}'`);
    }

    if (options.strategy) {
        filters.push(`strategy eq '${options.strategy}'`);
    }

    if (options.status) {
        filters.push(`status eq '${options.status}'`);
    }

    try {
        const entities = tableClient.listEntities({
            queryOptions: {
                filter: buildFilter(filters)
            }
        });

        for await (const entity of entities) {
            return entityToOrder(entity);
        }

        return null;
    } catch (error) {
        console.error('Error finding open order:', error);
        throw error;
    }
}

/**
 * Update an order with partial data
 * @param id - Row key (ID) of the order to update
 * @param updates - Partial order data to update
 */
export async function updateOrder(
    id: string,
    updates: Partial<{
        status: string;
        pnl: number;
        oid: string;
        stopLossOid: string;
        stopLossPrice: number;
    }>
): Promise<void> {
    try {
        const entities = tableClient.listEntities({
            queryOptions: {
                filter: `RowKey eq '${id}'`
            }
        });

        for await (const entity of entities) {
            const updateEntity: any = {
                partitionKey: entity.partitionKey!,
                rowKey: entity.rowKey!,
                updatedAt: new Date().toISOString(),
            };

            // Add only the fields that are provided
            if (updates.status !== undefined) {
                updateEntity.status = updates.status;
            }
            if (updates.pnl !== undefined) {
                updateEntity.pnl = updates.pnl.toString();
            }
            if (updates.oid !== undefined) {
                updateEntity.oid = updates.oid.toString();
            }
            if (updates.stopLossOid !== undefined) {
                updateEntity.stopLossOid = updates.stopLossOid.toString();
            }
            if (updates.stopLossPrice !== undefined) {
                updateEntity.stopLossPrice = updates.stopLossPrice.toString();
            }

            await tableClient.updateEntity(updateEntity, "Merge");
            return;
        }

        throw new Error(`Order with ID ${id} not found`);
    } catch (error) {
        console.error('Error updating order:', error);
        throw error;
    }
}