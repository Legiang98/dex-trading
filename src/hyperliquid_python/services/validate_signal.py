import os
from models.webhook import WebhookPayload, ValidationResult
from helpers.hyperliquid_helpers import get_env_config, create_clients
from repositories.dynamo_repository import get_order

def create_info_client():
    try:
        _, _, is_testnet = get_env_config()
    except ValueError:
        is_testnet = False
    
    # We do not strictly need private key just for Info
    from hyperliquid.info import Info
    from hyperliquid.utils import constants
    base_url = constants.TESTNET_API_URL if is_testnet else constants.MAINNET_API_URL
    
    # Testnet API currently has issues during SDK's spot market initialization.
    # To bypass this for perpetual trading, we pass an empty spot_meta to the constructor.
    return Info(base_url, skip_ws=True, spot_meta={"universe": [], "tokens": []})

def has_open_position(symbol: str, strategy: str, user_address: str) -> bool:
    try:
        info_client = create_info_client()
        open_order = get_order(symbol=symbol, strategy=strategy, status="open")
        if not open_order:
            return False
            
        open_order_oid = open_order.oid
        # Query order status by OID
        order_status = info_client.query({
            "type": "orderStatus",
            "user": user_address,
            "oid": int(open_order_oid) if str(open_order_oid).isdigit() else open_order_oid
        })
        
        if order_status.get("status") == "ok" and "order" in order_status:
            return order_status["order"].get("status") == "filled"
            
        print("Order not found or unknown status")
        return False
    except Exception as e:
        print(f"Error checking position: {e}")
        return False

def is_valid_symbol(symbol: str) -> bool:
    info_client = create_info_client()
    meta = info_client.meta()
    for asset in meta.get("universe", []):
        if asset.get("name") == symbol:
            return True
    return False

def is_valid_stop_loss(payload: WebhookPayload) -> bool:
    if payload.stopLoss is None:
        return False
        
    try:
        price = float(payload.price)
        stop_loss = float(payload.stopLoss)
        
        is_buy = payload.type == "BUY"
        return stop_loss < price if is_buy else stop_loss > price
    except (ValueError, TypeError):
        return False

def is_entry_action(action: str) -> bool:
    return action.upper() == "ENTRY"

def validate_signal(payload: WebhookPayload) -> ValidationResult:
    try:
        if not is_valid_symbol(payload.symbol):
            return ValidationResult(is_valid=False, reason=f"Invalid symbol: {payload.symbol}")
            
        user_address = os.environ.get("HYPERLIQUID_USER_ADDRESS")
        if not user_address:
            print("Warning: HYPERLIQUID_USER_ADDRESS not configured, skipping position check")
            return ValidationResult(is_valid=True)
            
        has_pos = has_open_position(payload.symbol, payload.strategy, user_address)
        
        if is_entry_action(payload.action) and has_pos:
            return ValidationResult(
                is_valid=False,
                skipped=True,
                reason=f"Already have open position for {payload.symbol} with strategy {payload.strategy}"
            )
            
        if is_entry_action(payload.action) and not is_valid_stop_loss(payload):
            return ValidationResult(is_valid=False, reason=f"Invalid stop loss for {payload.symbol}")
            
        if payload.action.upper() == "EXIT" and not has_pos:
            return ValidationResult(
                is_valid=False,
                skipped=True,
                reason=f"No open position found for {payload.symbol} with strategy {payload.strategy}"
            )
            
        return ValidationResult(is_valid=True)
    except Exception as e:
        import traceback
        print(f"Validation Error: {str(e)}")
        print(traceback.format_exc())
        return ValidationResult(is_valid=False, reason=f"Signal validation error: {str(e)}")
