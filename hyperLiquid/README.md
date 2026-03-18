# HyperLiquid Trading Bot (Azure Functions)

A high-performance, event-driven trading bot designed for HyperLiquid, optimized to prevent TradingView timeout errors and provide reliable trade execution.

## 🔄 The 3-Function Workflow

The system is split into three specialized functions to ensure speed and reliability:

### 1. `hyperLiquidWebhook` (The Gatekeeper) - HTTP Trigger
- **Role**: Receives signals from TradingView.
- **Speed**: Returns `200 OK` in milliseconds.
- **Process**:
  1. Validates the JSON schema.
  2. Pushes the signal to the `trade-signals` queue.
  3. Immediately acknowledges receipt to TradingView.

### 2. `processTrade` (The Executor) - Queue Trigger
- **Role**: Handles the "heavy lifting" in the background.
- **Process**:
  1. **Parses** the signal (normalizes symbols like `BTCUSDT` to `BTC`).
  2. **Validates** the state (checks symbols, leverage, and existing positions).
  3. **Builds** the order (calculates quantity based on fixed risk amount).
  4. **Executes** on HyperLiquid (places entry orders or closes positions).
  5. **Logs & Notifies**: Updates Azure Table Storage and sends Telegram alerts.

### 3. `reconcileTrades` (The Cleaner) - Timer Trigger
- **Role**: Runs every 6 hours to ensure database and exchange consistency.
- **Process**:
  1. Checks all "open" trades in the database.
  2. Verifies if they are still active on HyperLiquid.
  3. Marks orphaned or externally closed trades as `closed` in the database.

---

## 🚀 Getting Started

### Environment Configuration
Ensure your `.env` contains:
```env
HYPERLIQUID_PRIVATE_KEY=0x...
HYPERLIQUID_USER_ADDRESS=0x...
HYPERLIQUID_TESTNET=true
AzureWebJobsStorage=UseDevelopmentStorage=true
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_ENABLED=true
FIX_STOPLOSS=5 # Max USD to risk per stop loss distance
```

### Local Development
1. Start the Azurite storage emulator (or use a real connection string).
2. Run the function app:
   ```bash
   npm run build
   func start
   ```

### Mock Test for TradingView
You can simulate a TradingView signal locally:
```bash
curl -X POST http://localhost:7071/api/hyperLiquidWebhook \
-H "Content-Type: application/json" \
-d '{
  "symbol": "BTCUSDT",
  "action": "ENTRY",
  "type": "BUY",
  "price": 60000,
  "stopLoss": 59000,
  "strategy": "TrendFollower"
}'
```

---

## 🛠️ Technology Stack
- **Framework**: Azure Functions v4 (Node.js/TypeScript)
- **Exchange**: HyperLiquid API (@nktkas/hyperliquid)
- **Database**: Azure Table Storage (@azure/data-tables)
- **Validation**: Joi
- **Messaging**: Azure Storage Queues
