# Trading Tools Backend

This project hosts backend logic using **Azure Functions (TypeScript, v4 model)**. It leverages Azure services for logging and monitoring, and uses Pulumi (TypeScript) for infrastructure provisioning.

## Features

- **Azure Functions v4 (TypeScript):** Serverless backend logic.
- **Log Analytics Workspace & Application Insights:** Centralized logging and monitoring.
- **Infrastructure as Code:** All infra code is in the `infrastructure/` folder, managed by Pulumi (TypeScript).

## Project Structure

```
.
├── infrastructure/    # Pulumi IaC for Azure resources
├── src/               # Azure Functions source code
├── README.md
```

run this to deploy

func azure functionapp publish hyperliquid-dev-func
