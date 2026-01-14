import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as storage from "@pulumi/azure-native/storage";

// Import shared resources first
import "./shared";

// Import Hyperliquid function app infrastructure
import "./functionApps/tableStorage"
import "./functionApps/hyperliquid";
import "./functionApps/apim"
