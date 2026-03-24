import { AppError } from './errorHandler';
import { sendTelegramMessage } from './telegram';

export async function appInit() {
  // Table Storage doesn't require initialization
  // Connection is established on-demand via connection string
  console.log('App initialized - using Azure Table Storage');
}