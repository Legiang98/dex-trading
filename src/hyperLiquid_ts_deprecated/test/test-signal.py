import requests
import json
import time

# The endpoint from the user (with /webhook as defined in Terraform)
ENDPOINT = "https://u35yq8b6sh.execute-api.us-east-1.amazonaws.com/prod/webhook"

def test_signal():
    try:
        print(f"🔍 Fetching current BTC price from HyperLiquid...")
        # HyperLiquid Info API
        info_api = "https://api.hyperliquid.xyz/info"
        response = requests.post(info_api, json={"type": "allMids"})
        response.raise_for_status()
        mids = response.json()
        
        btc_price = float(mids.get("BTC", 0))
        if btc_price == 0:
            print("❌ Failed to fetch BTC price.")
            return

        print(f"💰 Current BTC Price: ${btc_price}")

        # Dist = (risk / target_value) * price
        # Using a 2% stop loss for testing (5x leverage allows ~20% max before liquidation)
        distance = 0.02 * btc_price
        sl_price = round(btc_price - distance, 2)

        payload = {
            "symbol": "BTCUSDT",
            "action": "ENTRY",
            "type": "BUY",
            "price": btc_price,
            "stopLoss": sl_price,
            "strategy": "PythonTester"
        }

        print(f"🚀 Sending mock signal to: {ENDPOINT}")
        print(f"📦 Payload:\n{json.dumps(payload, indent=2)}")

        start_time = time.time()
        response = requests.post(
            ENDPOINT,
            headers={"Content-Type": "application/json"},
            json=payload
        )
        duration_ms = int((time.time() - start_time) * 1000)

        print(f"\n📡 Status Code: {response.status_code}")
        print(f"⏱️ Duration: {duration_ms}ms")
        
        try:
            result = response.json()
            print(f"✅ Response Body:\n{json.dumps(result, indent=2)}")
        except json.JSONDecodeError:
            print(f"⚠️ Response Body (not JSON):\n{response.text}")

        if response.status_code == 403:
            print("\n❌ FORBIDDEN: This endpoint is IP-whitelisted in Terraform for TradingView only.")
            print("To test locally, you need to add your IP to the 'hl-webhook-api' resource policy in main.tf.")

    except Exception as e:
        print(f"❌ Test failed: {str(e)}")

if __name__ == "__main__":
    test_signal()
