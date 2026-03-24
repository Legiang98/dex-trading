import requests
import json
import sys

# Change this to your actual API Gateway URL from terraform output
# You can also set it as an environment variable API_URL
API_URL = "https://u35yq8b6sh.execute-api.us-east-1.amazonaws.com/prod/webhook"

def send_signal():
    payload = {
        "symbol": "BTCUSDT",
        "action": "ENTRY",
        "type": "BUY",
        "price": 70000.5,
        "stopLoss": 68000.0,
        "strategy": "PythonTestScript"
    }
    
    print(f"🚀 Sending mock signal to {API_URL}...")
    try:
        response = requests.post(API_URL, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            print("✅ Success! Signal accepted by Gatekeeper.")
        else:
            print(f"❌ Failed. Check CloudWatch logs for Gatekeeper.")
            
    except Exception as e:
        print(f"❌ Error during request: {e}")

if __name__ == "__main__":
    send_signal()
