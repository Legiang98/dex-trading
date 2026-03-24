from repositories.dynamo_repository import list_all_open_orders, update_order
from helpers.hyperliquid_helpers import get_env_config, create_clients

def handler(event, context):
    print("Reconciliation job started...")
    
    try:
        private_key, user_address, is_testnet = get_env_config()
        _, info_client = create_clients(private_key, is_testnet)
        
        db_open_trades = list_all_open_orders()
        if not db_open_trades:
            print("No open trades found in database. Finishing job.")
            return

        hl_open_orders = info_client.open_orders(user_address)
        hl_open_oids = set(str(order.get('oid')) for order in hl_open_orders)
        
        reconciled_count = 0
        
        for trade in db_open_trades:
            entry_oid_exists = str(trade.oid) in hl_open_oids if trade.oid else False
            stop_loss_oid_exists = str(trade.stopLossOid) in hl_open_oids if trade.stopLossOid else False
            
            if not entry_oid_exists and not stop_loss_oid_exists:
                print(f"Reconciling orphaned trade: Symbol={trade.symbol}, Strategy={trade.strategy}, ID={trade.id}")
                
                update_order(trade.id, status='closed')
                reconciled_count += 1
                
        print(f"Reconciliation job finished. Total trades checked: {len(db_open_trades)}, Reconciled: {reconciled_count}")
        
    except Exception as e:
        print(f"Error during trade reconciliation: {e}")
        raise e
