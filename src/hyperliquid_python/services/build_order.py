import os
import math
from models.webhook import WebhookPayload
from helpers.error_handler import AppError
from constants.http import HTTP

def normalize_order_size(size: float, sz_decimals: int) -> float:
    factor = math.pow(10, sz_decimals)
    return math.floor(size * factor) / factor

def validate_stoploss(order_type: str, price: float, current_leverage: float, position_size: float, stop_loss_price: float) -> bool:
    margin = (price * position_size) / current_leverage
    if order_type.lower() == "buy":
        liquidation_price = price - (margin / position_size)
        return stop_loss_price > liquidation_price
    else:
        liquidation_price = price + (margin / position_size)
        return stop_loss_price < liquidation_price

def build_order(signal: WebhookPayload) -> WebhookPayload:
    fixed_usd_amount = float(os.environ.get("FIX_STOPLOSS", "5"))
    user_address = os.environ.get("HYPERLIQUID_USER_ADDRESS")

    if not user_address:
        raise AppError("HYPERLIQUID_USER_ADDRESS not configured", HTTP.INTERNAL_SERVER_ERROR)

    from helpers.hyperliquid_helpers import get_env_config
    try:
        _, _, is_testnet = get_env_config()
    except ValueError:
        is_testnet = False

    from hyperliquid.info import Info
    from hyperliquid.utils import constants
    base_url = constants.TESTNET_API_URL if is_testnet else constants.MAINNET_API_URL
    # Bypass SDK testnet spot_meta bug
    info_client = Info(base_url, skip_ws=True, spot_meta={"universe": [], "tokens": []})

    all_mids = info_client.all_mids()
    market_price = float(all_mids.get(signal.symbol, 0))

    if not market_price:
        raise AppError(f"Unable to fetch market price for {signal.symbol}", HTTP.BAD_REQUEST)

    user_state = info_client.user_state(user_address)
    asset_positions = user_state.get("assetPositions", [])
    
    # Python SDK doesn't have an exact `activeAssetData` returning leverage natively without parsing user_state
    # The leverage is typically found in marginSummary or assetPositions
    # Let's extract current leverage from crossMarginSummary or from position if it exists.
    # Actually, info_client.user_state(user) has `assetPositions`, and `crossMarginSummary`.
    # Let's fetch the leverage from the account setting or meta
    # We will assume leverage is 5 if not found, since the user mentions 5x.
    # In official python SDK, leverage can be isolated or cross. 
    # For simplicity, if we don't know, we compute a conservative default or parse it from crossMarginSummary.
    
    current_leverage = 5.0 # fallback
    leverage_type = "cross"
    for pos in asset_positions:
        if pos.get("position", {}).get("coin") == signal.symbol:
            current_leverage = float(pos.get("position", {}).get("leverage", {}).get("value", 5))
            leverage_type = pos.get("position", {}).get("leverage", {}).get("type", "cross")
            break

    meta_response = info_client.meta()
    
    asset_meta = None
    asset_id = -1
    for idx, asset in enumerate(meta_response.get("universe", [])):
        if asset.get("name") == signal.symbol:
            asset_meta = asset
            asset_id = idx
            break

    if not asset_meta:
        raise AppError(f"Symbol {signal.symbol} not found in HyperLiquid", HTTP.BAD_REQUEST)

    sz_decimals_symbol = asset_meta.get("szDecimals", 0)

    stop_loss_price = float(signal.stopLoss) if signal.stopLoss else None
    
    if stop_loss_price is not None:
        raw_size = fixed_usd_amount / abs(market_price - stop_loss_price)
    else:
        raw_size = fixed_usd_amount / (market_price * 0.05) # fallback if no SL

    normalized_quantity = normalize_order_size(raw_size, sz_decimals_symbol)
    position_value = normalized_quantity * market_price

    from helpers.market_price_helpers import format_price_for_order
    normalized_price = float(format_price_for_order(market_price, sz_decimals_symbol))
    normalized_stop_loss = float(format_price_for_order(stop_loss_price, sz_decimals_symbol)) if stop_loss_price else None

    order_type = "buy" if signal.type.upper() == "BUY" else "sell"
    if stop_loss_price is not None:
        is_stoploss_valid = validate_stoploss(
            order_type,
            market_price,
            current_leverage,
            normalized_quantity,
            stop_loss_price
        )
        if not is_stoploss_valid:
            raise AppError(f"Invalid stop loss price {signal.stopLoss} for {signal.symbol} with current leverage {current_leverage}", HTTP.BAD_REQUEST)

    # Convert to dict, update fields, convert back
    payload_dict = signal.model_dump()
    payload_dict["quantity"] = normalized_quantity
    payload_dict["price"] = normalized_price
    payload_dict["stopLoss"] = normalized_stop_loss
    payload_dict["positionValue"] = position_value

    return WebhookPayload(**payload_dict)
