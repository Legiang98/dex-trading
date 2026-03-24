import os
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants
from helpers.error_handler import AppError
from constants.http import HTTP
from repositories.dynamo_repository import get_order

def get_env_config():
    from helpers.config_helpers import get_secret
    
    # Use environment var to determine the SSM path
    ssm_path = os.environ.get("SSM_PRIVATE_KEY_PATH", "/hl/private_key")
    private_key = get_secret("HYPERLIQUID_PRIVATE_KEY", ssm_path)
    
    user_address = os.environ.get("HYPERLIQUID_USER_ADDRESS")
    is_testnet = os.environ.get("HYPERLIQUID_TESTNET") == "true"
    
    if not private_key:
        raise ValueError(f"HYPERLIQUID_PRIVATE_KEY not configured in env or SSM ({ssm_path})")
    if not user_address:
        raise ValueError("HYPERLIQUID_USER_ADDRESS not configured")
        
    return private_key, user_address, is_testnet

def create_clients(private_key: str, is_testnet: bool):
    from eth_account import Account
    import logging
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    account = Account.from_key(private_key)
    base_url = constants.TESTNET_API_URL if is_testnet else constants.MAINNET_API_URL

    # Both Info and Exchange constructors need spot_meta bypass on testnet
    # This avoids the "list index out of range" error in hyperliquid-python-sdk
    safe_spot_meta = {"universe": [], "tokens": []}
    info_client = Info(base_url, skip_ws=True, spot_meta=safe_spot_meta)
    exchange_client = Exchange(account, base_url, spot_meta=safe_spot_meta)

    return exchange_client, info_client

def extract_order_id(status: dict) -> int:
    if not status:
        raise AppError("Order status is missing", HTTP.BAD_REQUEST)
        
    resting = status.get('resting')
    if resting and resting.get('oid'):
        return resting.get('oid')
        
    filled = status.get('filled')
    if filled and filled.get('oid'):
        return filled.get('oid')
        
    raise AppError("Order ID not found in response", HTTP.BAD_REQUEST)

def get_asset_info(info_client: Info, symbol: str):
    meta = info_client.meta()
    
    asset_info = None
    asset_id = -1
    
    for idx, asset in enumerate(meta.get('universe', [])):
        if asset.get('name') == symbol:
            asset_info = asset
            asset_id = idx
            break
            
    if not asset_info:
        raise AppError(f"Asset {symbol} not found", HTTP.BAD_REQUEST)
        
    return asset_info, asset_id

def get_strategy_position(info_client: Info, user_address: str, symbol: str, strategy: str):
    user_data = info_client.user_state(user_address)
    
    position_data = None
    for pos in user_data.get('assetPositions', []):
        if pos.get('position', {}).get('coin') == symbol:
            position_data = pos
            break
            
    if not position_data:
        raise AppError(f"No open position found for {symbol}", HTTP.BAD_REQUEST)
        
    open_order = get_order(symbol=symbol, strategy=strategy, status="open")
    if not open_order:
        raise AppError(f"No open order found for {symbol}/{strategy}", HTTP.BAD_REQUEST)
        
    print("Order id", open_order.oid)
    strategy_position = open_order.quantity
    is_buy = open_order.order_type == "BUY"
    id = open_order.id
    oid = open_order.oid
    
    full_position = abs(float(position_data.get('position', {}).get('szi', '0')))
    if full_position < strategy_position:
        raise AppError(f"Position size ({full_position}) is less than order size ({strategy_position})", HTTP.BAD_REQUEST)
        
    return strategy_position, is_buy, id, oid

def get_order_pnl(info_client: Info, user_address: str, oid: str):
    try:
        user_fills = info_client.user_fills(user_address)
        
        order_trades = [fill for fill in user_fills if str(fill.get('oid')) == oid]
        if not order_trades:
            return {"totalPnl": 0, "totalFees": 0, "netPnl": 0, "trades": []}
            
        total_pnl = 0.0
        total_fees = 0.0
        
        for trade in order_trades:
            pnl = float(trade.get('closedPnl', '0'))
            fee = abs(float(trade.get('fee', '0')))
            
            total_pnl += pnl
            total_fees += fee
            
        net_pnl = total_pnl - total_fees
        
        return {
            "totalPnl": total_pnl,
            "totalFees": total_fees,
            "netPnl": net_pnl,
            "trades": order_trades
        }
    except Exception as e:
        print("[get_order_pnl] Error fetching order PnL:", e)
        raise e
