import os
import boto3
from botocore.exceptions import ClientError

def get_secret(env_name, ssm_path, default=None):
    """
    Fetch a configuration value from environment variables, 
    falling back to SSM Parameter Store if missing.
    """
    # 1. Try Environment Variable first
    value = os.environ.get(env_name)
    if value:
        return value

    # 2. Try SSM Parameter Store
    try:
        ssm = boto3.client('ssm', region_name=os.environ.get("AWS_REGION", "us-east-1"))
        response = ssm.get_parameter(Name=ssm_path, WithDecryption=True)
        return response['Parameter']['Value']
    except ClientError as e:
        # If parameter doesn't exist or permission denied, fall back to default
        return default
    except Exception:
        return default
