import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { OrderRecord, NewOrder } from '../models/order';
import * as crypto from "crypto";

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.DYNAMODB_TABLE_NAME || "hl-orders";

export async function insertOrder(order: NewOrder): Promise<OrderRecord> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    const item = {
        id,
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
        createdAt: createdAt,
        updatedAt: createdAt,
    };

    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: item
    }));
    
    return entityToOrder(item);
}

function entityToOrder(entity: any): OrderRecord {
    return {
        partitionKey: `${entity.symbol}_${entity.strategy}`,
        id: entity.id,
        user_address: entity.userAddress,
        symbol: entity.symbol,
        strategy: entity.strategy,
        quantity: parseFloat(entity.quantity),
        order_type: entity.orderType,
        price: parseFloat(entity.price),
        oid: entity.oid,
        stopLossOid: entity.stopLossOid || undefined,
        stopLossPrice: entity.stopLossPrice ? parseFloat(entity.stopLossPrice) : undefined,
        pnl: entity.pnl ? parseFloat(entity.pnl) : undefined,
        status: entity.status,
        created_at: new Date(entity.createdAt),
        updated_at: new Date(entity.updatedAt),
    };
}

export async function getOrder(options: {
    symbol?: string;
    strategy?: string;
    id?: string;
    status?: string;
}): Promise<OrderRecord | null> {
    
    let filterExpression = [];
    let expressionAttributeValues: any = {};
    let expressionAttributeNames: any = {};
    
    if (options.id) {
        filterExpression.push("id = :id");
        expressionAttributeValues[":id"] = options.id;
    }
    if (options.symbol) {
        filterExpression.push("#sym = :sym");
        expressionAttributeNames["#sym"] = "symbol";
        expressionAttributeValues[":sym"] = options.symbol;
    }
    if (options.strategy) {
        filterExpression.push("strategy = :strategy");
        expressionAttributeValues[":strategy"] = options.strategy;
    }
    if (options.status) {
        filterExpression.push("#st = :st");
        expressionAttributeNames["#st"] = "status";
        expressionAttributeValues[":st"] = options.status;
    }

    const scanParams: any = {
        TableName: tableName
    };

    if (filterExpression.length > 0) {
        scanParams.FilterExpression = filterExpression.join(" AND ");
        scanParams.ExpressionAttributeValues = expressionAttributeValues;
        if (Object.keys(expressionAttributeNames).length > 0) {
            scanParams.ExpressionAttributeNames = expressionAttributeNames;
        }
    }

    const { Items } = await docClient.send(new ScanCommand(scanParams));
    if (Items && Items.length > 0) {
        return entityToOrder(Items[0]);
    }
    return null;
}

export async function listAllOpenOrders(): Promise<OrderRecord[]> {
    const { Items } = await docClient.send(new ScanCommand({
        TableName: tableName,
        FilterExpression: "#st = :status",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":status": "open" }
    }));
    
    return (Items || []).map(entityToOrder);
}

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
    const updateExpressions: string[] = ["updatedAt = :updatedAt"];
    const expressionAttributeValues: any = {
        ":updatedAt": new Date().toISOString()
    };
    const expressionAttributeNames: any = {};

    if (updates.status !== undefined) {
        updateExpressions.push("#st = :status");
        expressionAttributeNames["#st"] = "status";
        expressionAttributeValues[":status"] = updates.status;
    }
    if (updates.pnl !== undefined) {
        updateExpressions.push("pnl = :pnl");
        expressionAttributeValues[":pnl"] = updates.pnl.toString();
    }
    if (updates.oid !== undefined) {
        updateExpressions.push("oid = :oid");
        expressionAttributeValues[":oid"] = updates.oid.toString();
    }
    if (updates.stopLossOid !== undefined) {
        updateExpressions.push("stopLossOid = :stopLossOid");
        expressionAttributeValues[":stopLossOid"] = updates.stopLossOid.toString();
    }
    if (updates.stopLossPrice !== undefined) {
        updateExpressions.push("stopLossPrice = :stopLossPrice");
        expressionAttributeValues[":stopLossPrice"] = updates.stopLossPrice.toString();
    }

    const updateParams: any = {
        TableName: tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeValues: expressionAttributeValues,
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
        updateParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    await docClient.send(new UpdateCommand(updateParams));
}
