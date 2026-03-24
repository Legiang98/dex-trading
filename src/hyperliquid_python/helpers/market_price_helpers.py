import math

def get_market_price(info_client, symbol: str, is_buy: bool) -> float:
    all_mids = info_client.all_mids()
    market_price = float(all_mids.get(symbol, 0))
    if not market_price:
        raise ValueError(f"Unable to fetch market price for {symbol}")

    price_adjustment = 1.001 if is_buy else 0.999
    return market_price * price_adjustment

def format_price_for_order(price: float, sz_decimals: int) -> str:
    # Max 5 significant figures
    max_decimals = 5
    if price <= 0:
        return "0"
    px_decimals = max(0, max_decimals - math.floor(math.log10(price)) - 1)
    # szDecimals is actually max decimals allowed sometimes, but hyperliquid API usually just uses 5 sig figs.
    # The ts code uses Math.min(pxDecimals, szDecimals) but let's just use 5 sig figs:
    formatted = f"{price:.{min(px_decimals, sz_decimals)}f}"
    return formatted

def get_formatted_market_price(info_client, symbol: str, is_buy: bool, sz_decimals: int) -> str:
    market_price = get_market_price(info_client, symbol, is_buy)
    return format_price_for_order(market_price, sz_decimals)
