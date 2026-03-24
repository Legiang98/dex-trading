import hyperliquid.info

# Save the original __init__ to call it if possible, or redefine a safe version
original_init = hyperliquid.info.Info.__init__

def safe_info_init(self, base_url, skip_ws=False):
    # Call the original and gracefully catch testnet index errors 
    try:
        original_init(self, base_url, skip_ws)
    except IndexError as e:
        print(f"Caught hyperliquid SDK index error: {e}. Applying safe init fallback...")
        self.base_url = base_url
        self.skip_ws = skip_ws
        self.coin_to_asset = {}
        self.name_to_coin = {}
        self.asset_to_sz_decimals = {}

        meta = self.meta()
        for spot_info in meta["universe"]:
            self.coin_to_asset[spot_info["name"]] = spot_info["name"]
            self.name_to_coin[spot_info["name"]] = spot_info["name"]
            self.asset_to_sz_decimals[spot_info["name"]] = spot_info["szDecimals"]

        spot_meta = self.spot_meta()
        if spot_meta:
            tokens = spot_meta.get("tokens", [])
            for spot_info in spot_meta.get("universe", []):
                asset = spot_info["index"] + 10000
                self.coin_to_asset[spot_info["name"]] = asset
                self.name_to_coin[spot_info["name"]] = spot_info["name"]
                base, quote = spot_info["tokens"]
                try:
                    base_info = tokens[base]
                    quote_info = tokens[quote]
                    self.asset_to_sz_decimals[asset] = base_info["szDecimals"]
                    name = f'{base_info["name"]}/{quote_info["name"]}'
                    if name not in self.name_to_coin:
                        self.name_to_coin[name] = spot_info["name"]
                except IndexError:
                    pass

        # Since we use skip_ws=True everywhere in lambda functions
        self.ws_manager = None
        self.user_state_map = {}

# Monkey patch the SDK
hyperliquid.info.Info.__init__ = safe_info_init
