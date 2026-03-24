import requests

response = requests.post('https://api.hyperliquid.xyz/info', json={'type': 'spotMetaAndAssetCtxs'})
resp = response.json()
spot_meta = resp[0]
for idx, spot_info in enumerate(spot_meta['universe']):
    base, quote = spot_info['tokens']
    if base >= len(spot_meta['tokens']) or quote >= len(spot_meta['tokens']):
        print(f"Error at asset {spot_info['name']}: base={base}, quote={quote}, len={len(spot_meta['tokens'])}")
        
print("Done mainnet")
