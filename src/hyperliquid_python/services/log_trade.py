from datetime import datetime
import json
from models.webhook import WebhookPayload
from models.common import OrderResult


def log_trade(signal: WebhookPayload, result: OrderResult) -> None:
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "symbol": signal.symbol,
        "action": signal.action,
        "type": signal.type,
        "price": signal.price,
        "stopLoss": signal.stopLoss,
        "success": result.success,
        "orderId": result.orderId,
        "message": result.message,
        "error": result.error,
    }
