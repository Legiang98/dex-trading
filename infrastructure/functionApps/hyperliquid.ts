import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as resources from "@pulumi/azure-native/resources";
import * as storage from "@pulumi/azure-native/storage";
import * as web from "@pulumi/azure-native/web";
import * as applicationinsights from "@pulumi/azure-native/applicationinsights";
import {
    tableStorageConnectionString
} from "./tableStorage";
import { resourceGroup, location, environment, commonTags } from "../shared";

const config = new pulumi.Config();


const storageAccount = new storage.StorageAccount("hyperliquidsa", {
    accountName: `hyperliquid${environment}sa`,
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    sku: {
        name: storage.SkuName.Standard_LRS
    },
    kind: storage.Kind.StorageV2,
    allowBlobPublicAccess: false,
    minimumTlsVersion: storage.MinimumTlsVersion.TLS1_2,
    tags: commonTags
});

const appServicePlan = new web.AppServicePlan("hyperliquid-plan", {
    name: `hyperliquid-${environment}-plan`,
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    sku: {
        name: "Y1", tier: "Dynamic"
    },
    kind: "functionapp,linux",
    tags: commonTags
});

const storageConnectionString = pulumi
    .all([resourceGroup.name, storageAccount.name])
    .apply(([resourceGroupName, storageAccountName]) =>
        storage.listStorageAccountKeysOutput({ resourceGroupName, accountName: storageAccountName })
    )
    .apply(keys => {
        const primaryKey = keys.keys[0].value;
        return pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${primaryKey};EndpointSuffix=core.windows.net`;
    });

const workspace = new azure_native.operationalinsights.Workspace("hyperliquid-workspace", {
    resourceGroupName: resourceGroup.name,
    workspaceName: `hyperliquid-${environment}-workspace`,
    location: resourceGroup.location,
    sku: { name: "PerGB2018" },
    retentionInDays: 30,
    tags: commonTags
});

const appInsights = new applicationinsights.Component("hyperliquid-insights", {
    resourceName: `hyperliquid-${environment}-insights`,
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    applicationType: applicationinsights.ApplicationType.Web,
    workspaceResourceId: workspace.id,
    kind: "web",
    tags: commonTags
});

const functionApp = new web.WebApp("hyperliquid-function", {
    name: `hyperliquid-${environment}-func`,
    resourceGroupName: resourceGroup.name,
    location: resourceGroup.location,
    serverFarmId: appServicePlan.id,
    kind: "functionapp,linux",
    httpsOnly: true,
    siteConfig: {
        appSettings: [],
        cors: { allowedOrigins: ["*"] },
        use32BitWorkerProcess: false,
        ftpsState: web.FtpsState.FtpsOnly,
        minTlsVersion: "1.2",
        http20Enabled: true,
        nodeVersion: "~22",
        ipSecurityRestrictions: [
            {
                ipAddress: "52.89.214.238/32",
                action: "Allow",
                priority: 100,
                name: "TradingView-1"
            },
            {
                ipAddress: "34.212.75.30/32",
                action: "Allow",
                priority: 101,
                name: "TradingView-2"
            },
            {
                ipAddress: "54.218.53.128/32",
                action: "Allow",
                priority: 102,
                name: "TradingView-3"
            },
            {
                ipAddress: "52.32.178.7/32",
                action: "Allow",
                priority: 103,
                name: "TradingView-4"
            },
            {
                ipAddress: "0.0.0.0/0",
                action: "Allow",
                priority: 200,
                name: "Allow-All"
            }
        ]
    },
    tags: commonTags
});

const appSettings = new web.WebAppApplicationSettings("hyperliquid-app-settings", {
    name: functionApp.name,
    resourceGroupName: resourceGroup.name,
    properties: {
        // Azure function app settings
        AzureWebJobsStorage: storageConnectionString,
        WEBSITE_CONTENTAZUREFILECONNECTIONSTRING: storageConnectionString,
        WEBSITE_CONTENTSHARE: pulumi.interpolate`hyperliquid-${environment}-func-content`,
        FUNCTIONS_EXTENSION_VERSION: "~4",
        FUNCTIONS_WORKER_RUNTIME: "node",
        WEBSITE_NODE_DEFAULT_VERSION: "~22",
        WEBSITE_RUN_FROM_PACKAGE: "1",

        // HyperLiquid Settings
        HYPERLIQUID_TESTNET: config.get("hyperliquid-testnet") || "true",
        HYPERLIQUID_USER_ADDRESS: config.require("hyperliquid-user-address"),
        HYPERLIQUID_PRIVATE_KEY: config.requireSecret("hyperliquid-private-key"),

        // Telegram Notifications
        TELEGRAM_CHAT_ID: config.requireSecret("telegram_chat_id"),
        TELEGRAM_BOT_TOKEN: config.requireSecret("telegram_bot_token"),

        // Order configuration
        FIX_STOPLOSS: config.get("fix-stoploss") || "",

        // Azure Table Storage Settings
        AZURE_STORAGE_CONNECTION_STRING: tableStorageConnectionString,

        // Application Insights
        APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.connectionString,
        ApplicationInsightsAgent_EXTENSION_VERSION: "~3",

        TELEGRAM_ENABLED: "true",
        TABLE_NAME: "orders"
    }
});

export const resourceGroupName = resourceGroup.name;
export const functionAppName = functionApp.name;
export const functionAppUrl = pulumi.interpolate`https://${functionApp.defaultHostName}`;
export const storageAccountName = storageAccount.name;
export const appInsightsInstrumentationKey = appInsights.instrumentationKey;
export const appInsightsConnectionString = appInsights.connectionString;
export const appServicePlanName = appServicePlan.name;
