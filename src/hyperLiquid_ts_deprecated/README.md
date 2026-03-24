# HyperLiquid Trading Bot (AWS Migration)

High-performance, low-latency trading bot refactored from Azure Functions to AWS Lambda, utilizing SQS for asynchronous trade execution and DynamoDB for order tracking.

## 🏗️ Architecture

![Architecture](architecture.png)

### **Key Components**
1.  **Gatekeeper (HTTP Lambda)**: Receives signals from TradingView via API Gateway. Performs fast Joi validation and pushes to SQS. Target latency: **<200ms**.
2.  **Executor (SQS Lambda)**: Consumes signals from SQS. Fetches market data, applies risk/sizing logic ($5-10 risk, $20 target), and executes orders via HyperLiquid API. Logs results to DynamoDB.
3.  **Cleaner (EventBridge Lambda)**: Runs every 6 hours. Reconciles DynamoDB records with actual HyperLiquid positions to handle manual closures or edge cases.

---

## 🚀 Quick Start (Deployment)

All infrastructure is managed via Terraform and can be deployed with a single command from the `terraform/` directory.

### **Prerequisites**
- AWS CLI configured with your `lab` profile.
- Python 3.x (for diagram generation).
- Node.js & NPM.

### **Build and Deploy**
Navigate to the `terraform/` directory and run:

```bash
make deploy
```

**Note:** This command automatically:
1.  Cleans and builds the TypeScript project.
2.  Bundles Lambdas with `esbuild` for maximum performance.
3.  Zips the outputs.
4.  Applies the Terraform configuration.

---

## 🛠️ Project Structure
- **/functions**: Lambda entry points (Handlers).
- **/services**: Domain logic (Order building, validation).
- **/repositories**: Data access layer (DynamoDB).
- **/models**: TypeScript interfaces and domain models.
- **/terraform**: Infrastructure as Code (SQS, DynamoDB, API GW, IAM).

## 🧪 Testing
You can test the logic using the provided test scripts:
```bash
npm run test:signal
```

---

## 🛠️ Infrastructure Commands
From the `terraform/` directory:
- `make build`: Bundle and zip Lambdas.
- `make plan`: Show infrastructure changes.
- `make deploy`: Deploy everything to AWS.
- `make init`: Re-initialize terraform/backend.
