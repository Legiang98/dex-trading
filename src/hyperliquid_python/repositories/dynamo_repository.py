import os
import uuid
import boto3
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from models.order import OrderRecord, NewOrder

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get("AWS_REGION", "us-east-1"))
table_name = os.environ.get("DYNAMODB_TABLE_NAME", "hl-orders")
table = dynamodb.Table(table_name)

def entity_to_order(entity: dict) -> OrderRecord:
    return OrderRecord(
        partitionKey=f"{entity.get('symbol')}_{entity.get('strategy')}",
        id=entity.get('id'),
        user_address=entity.get('userAddress'),
        symbol=entity.get('symbol'),
        strategy=entity.get('strategy'),
        quantity=float(entity.get('quantity')),
        order_type=entity.get('orderType'),
        price=float(entity.get('price')),
        oid=entity.get('oid'),
        stopLossOid=entity.get('stopLossOid') if entity.get('stopLossOid') else None,
        stopLossPrice=float(entity.get('stopLossPrice')) if entity.get('stopLossPrice') else None,
        pnl=float(entity.get('pnl')) if entity.get('pnl') else None,
        status=entity.get('status'),
        created_at=datetime.fromisoformat(entity.get('createdAt').replace('Z', '+00:00')),
        updated_at=datetime.fromisoformat(entity.get('updatedAt').replace('Z', '+00:00'))
    )

def insert_order(order: NewOrder) -> OrderRecord:
    order_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    
    item = {
        'id': order_id,
        'userAddress': order.user_address,
        'symbol': order.symbol,
        'strategy': order.strategy,
        'quantity': str(order.quantity),
        'orderType': order.order_type,
        'price': str(order.price),
        'oid': order.oid,
        'stopLossOid': order.stopLossOid or '',
        'stopLossPrice': str(order.stopLossPrice) if order.stopLossPrice else '',
        'pnl': '',
        'status': order.status,
        'createdAt': created_at,
        'updatedAt': created_at,
    }

    table.put_item(Item=item)
    return entity_to_order(item)

def get_order(
    symbol: Optional[str] = None,
    strategy: Optional[str] = None,
    id: Optional[str] = None,
    status: Optional[str] = None
) -> Optional[OrderRecord]:
    
    filter_expressions = []
    expression_attribute_values = {}
    expression_attribute_names = {}
    
    if id:
        filter_expressions.append("id = :id")
        expression_attribute_values[":id"] = id
    if symbol:
        filter_expressions.append("#sym = :sym")
        expression_attribute_names["#sym"] = "symbol"
        expression_attribute_values[":sym"] = symbol
    if strategy:
        filter_expressions.append("strategy = :strategy")
        expression_attribute_values[":strategy"] = strategy
    if status:
        filter_expressions.append("#st = :st")
        expression_attribute_names["#st"] = "status"
        expression_attribute_values[":st"] = status

    scan_params = {}
    
    if filter_expressions:
        scan_params['FilterExpression'] = " AND ".join(filter_expressions)
        scan_params['ExpressionAttributeValues'] = expression_attribute_values
        if expression_attribute_names:
            scan_params['ExpressionAttributeNames'] = expression_attribute_names

    response = table.scan(**scan_params)
    items = response.get('Items', [])
    
    if items:
        # returns the first one just like JS code
        return entity_to_order(items[0])
    return None

def list_all_open_orders() -> List[OrderRecord]:
    response = table.scan(
        FilterExpression="#st = :status",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":status": "open"}
    )
    items = response.get('Items', [])
    return [entity_to_order(item) for item in items]

def update_order(
    id: str,
    status: Optional[str] = None,
    pnl: Optional[float] = None,
    oid: Optional[str] = None,
    stopLossOid: Optional[str] = None,
    stopLossPrice: Optional[float] = None
) -> None:
    update_expressions = ["updatedAt = :updatedAt"]
    expression_attribute_values = {
        ":updatedAt": datetime.now(timezone.utc).isoformat()
    }
    expression_attribute_names = {}

    if status is not None:
        update_expressions.append("#st = :status")
        expression_attribute_names["#st"] = "status"
        expression_attribute_values[":status"] = status
    if pnl is not None:
        update_expressions.append("pnl = :pnl")
        expression_attribute_values[":pnl"] = str(pnl)
    if oid is not None:
        update_expressions.append("oid = :oid")
        expression_attribute_values[":oid"] = str(oid)
    if stopLossOid is not None:
        update_expressions.append("stopLossOid = :stopLossOid")
        expression_attribute_values[":stopLossOid"] = str(stopLossOid)
    if stopLossPrice is not None:
        update_expressions.append("stopLossPrice = :stopLossPrice")
        expression_attribute_values[":stopLossPrice"] = str(stopLossPrice)

    update_params = {
        'Key': {'id': id},
        'UpdateExpression': f"SET {', '.join(update_expressions)}",
        'ExpressionAttributeValues': expression_attribute_values
    }

    if expression_attribute_names:
        update_params['ExpressionAttributeNames'] = expression_attribute_names

    table.update_item(**update_params)
