from models.webhook import WebhookPayload

def parse_webhook(payload: dict) -> WebhookPayload:
    """
    Parse and normalize webhook payload
    Removes "USDT" suffix from symbol names to match HyperLiquid format
    """
    symbol = payload.get("symbol", "")
    if symbol.endswith("USDT"):
        payload["symbol"] = symbol[:-4]
    
    return WebhookPayload(**payload)
