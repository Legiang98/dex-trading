from models.webhook import WebhookPayload
from models.common import OrderResult
from helpers.error_handler import AppError
from constants.http import HTTP
from helpers.telegram import send_notification
from helpers.hyperliquid_helpers import (
    get_env_config, create_clients, get_asset_info, 
    get_strategy_position, get_order_pnl, extract_order_id
)
from helpers.market_price_helpers import get_formatted_market_price
from repositories.dynamo_repository import update_order

def close_order(signal: WebhookPayload) -> OrderResult:
    try:
        print(f"[close_order] Received signal: {signal.model_dump()}")

        private_key, user_address, is_testnet = get_env_config()
        exchange_client, info_client = create_clients(private_key, is_testnet)
        asset_info, asset_id = get_asset_info(info_client, signal.symbol)

        strategy_position, is_buy, db_id, oid = get_strategy_position(
            info_client, user_address, signal.symbol, signal.strategy
        )

        sz_decimals = int(asset_info.get("szDecimals", 0))
        market_price = get_formatted_market_price(info_client, signal.symbol, is_buy, sz_decimals)

        # Build order
        # bulk_orders expects OrderRequest objects (not raw wires)
        order = {
            "coin": signal.symbol,
            "is_buy": not is_buy,
            "sz": float(strategy_position),
            "limit_px": float(market_price),
            "order_type": {"limit": {"tif": "Gtc"}},
            "reduce_only": True
        }

        # Execute using bulk_orders
        close_response = exchange_client.bulk_orders([order])

        # Parse the response dict
        try:
            statuses = close_response.get("response", {}).get("data", {}).get("statuses", [])
        except AttributeError:
            if isinstance(close_response, dict) and 'response' in close_response:
                statuses = close_response['response']['data']['statuses']
            else:
                statuses = close_response.get("status", [])

        if not statuses:
            raise AppError("Order response missing statuses", HTTP.BAD_REQUEST)

        order_status = statuses[0]
        if 'error' in order_status:
            raise AppError(f"Failed to close position: {order_status['error']}", HTTP.BAD_REQUEST)

        close_order_id = extract_order_id(order_status)
        pnl_data = get_order_pnl(info_client, user_address, str(oid))

        update_order(
            id=db_id,
            status='closed',
            pnl=pnl_data.get('netPnl'),
            stopLossOid=str(close_order_id)
        )

        send_notification(
            title="Order Closed",
            symbol=signal.symbol,
            is_buy=is_buy,
            price=signal.price,
            stop_loss=signal.stopLoss,
            position_value=signal.positionValue,
            pnl=pnl_data
        )

        return OrderResult(
            success=True,
            message=f"Closed {signal.symbol} position",
            orderId=str(oid),
            stopLossOrderId=str(close_order_id),
            dbOrderId=db_id
        )

    except Exception as error:
        return OrderResult(
            success=False,
            error=str(error)
        )
