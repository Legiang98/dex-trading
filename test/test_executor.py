import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../src/hyperliquid_python')))

import json
from unittest.mock import patch, MagicMock

# Mock out helpers and services that might need external state
sys.modules['helpers.telegram'] = MagicMock()
sys.modules['repositories.dynamo_repository'] = MagicMock()

# Setup environ variables BEFORE importing the handler or any config
os.environ["HYPERLIQUID_USER_ADDRESS"] = "0xExampleAddress"
os.environ["HYPERLIQUID_PRIVATE_KEY"] = "0xExampleKey"

from functions.executor import handler as executor_handler

@patch('functions.executor.build_order')
@patch('functions.executor.execute_order')
@patch('functions.executor.log_trade')
def test_executor(mock_log, mock_exec, mock_build):
    
    mock_build.return_value = MagicMock()
    mock_build.return_value.model_dump_json.return_value = "{}"
    mock_exec.return_value = MagicMock()
    mock_exec.return_value.model_dump.return_value = {}

    sqs_event = {
        "Records": [
            {
                "body": json.dumps({
                    "action": "ENTRY",
                    "type": "BUY",
                    "symbol": "BTCUSDT",
                    "price": "50000",
                    "stopLoss": "49000",
                    "strategy": "Test"
                })
            }
        ]
    }
    
    executor_handler(sqs_event, {})
    
if __name__ == "__main__":
    test_executor()
