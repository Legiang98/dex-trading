import boto3
import argparse
import sys

def update_param(name, value, description=""):
    ssm = boto3.client('ssm')
    print(f"Updating {name}...")
    try:
        ssm.put_parameter(
            Name=name,
            Value=value,
            Type='SecureString',
            Overwrite=True,
            Description=description
        )
        print(f"✅ Successfully updated {name}")
    except Exception as e:
        print(f"❌ Failed to update {name}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update SSM Parameters for HyperLiquid Bot")
    parser.add_argument("--key", help="HyperLiquid Private Key")
    parser.add_argument("--token", help="Telegram Bot Token")
    
    args = parser.parse_args()
    
    if not args.key and not args.token:
        print("Usage: python3 update_secrets.py --key YOUR_PRIVATE_KEY --token YOUR_TELEGRAM_TOKEN")
        sys.exit(1)
        
    if args.key:
        update_param("/hl/private_key", args.key, "HyperLiquid Wallet Private Key")
    
    if args.token:
        update_param("/hl/telegram_token", args.token, "Telegram Bot Token")
