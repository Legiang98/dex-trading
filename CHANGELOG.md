# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-aws-python] - 2026-03-24

### Added
- **Infrastructure**: Full AWS Serverless stack migration using Terraform.
  - **Gatekeeper Lambda**: Fast signal ingestion (<200ms) with SQS buffering.
  - **Executor Lambda**: Async trade processing triggered by SQS events.
  - **Cleaner Lambda**: Background reconciliation job via EventBridge (Cron).
  - **SQS Queue**: Decoupling signal ingestion from trade execution.
  - **DynamoDB**: High-availability storage for trade status and audit logs.
- **Python SDK**: Integrated `hyperliquid-python-sdk` for all HyperLiquid interactions.
- **Pydantic Models**: Added type-safe data validation for webhook payloads and order records.
- **Improved Testing**: Comprehensive Python-based test suite in the `/test` directory.
  - `test_gatekeeper.py`: Signal ingestion verification.
  - `test_executor.py`: Trade logic and SDK simulation.
  - `test_fix_verification.py`: Testnet metadata bug fix verification.
  - `test_signal.py`: Integration test for sending mock TradingView signals to AWS.
  - `update_secrets.py`: Secure script for managing API keys and bot tokens in SSM.
- **Secret Management**: Migrated sensitive keys (`HYPERLIQUID_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`) from Lambda environment variables to **AWS SSM Parameter Store** for improved security.
- **SDK Fix**: Implemented a comprehensive bypass for `IndexError` in both `Info` and `Exchange` constructors of the `hyperliquid-python-sdk` when parsing testnet metadata.
- **Payload Fix**: Corrected `bulk_orders` payload format from raw wires to `OrderRequest` objects to resolve `KeyError: 'coin'`.
- **Log Consolidation**: Streamlined and cleaned trade execution logs in CloudWatch for better readability.

### Changed
- **Migration**: Full migration of the trading bot from **Azure Function App** (Node.js/TypeScript) to **AWS Lambda** (Python).
- **Core Engine**: Rewrote trade logic to utilize Python's async capabilities and the official HyperLiquid Python SDK.
- **Symbol Normalization**: Refined symbol parsing to handle USDT suffixes automatically.
- **Logging**: Enhanced observability with detailed AWS CloudWatch logging and Telegram notifications.

### Removed
- **Azure Infrastructure**: Deprecated deployment configurations for Azure Functions.
- **TypeScript Core**: Shifted primary development from TypeScript to Python for the core trading logic.

---

## [0.2.0-azure] - Recent
- Implemented `reconcileTrade` function for Azure.
- Fixed time response issues in Azure functions.
- Initial CI/CD pipeline setup.
