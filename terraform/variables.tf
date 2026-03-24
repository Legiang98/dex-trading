variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "hl_user_address" {
  type        = string
  description = "HyperLiquid user address (wallet public key)"
}

variable "hl_private_key" {
  type        = string
  description = "HyperLiquid wallet private key"
  sensitive   = true
}

variable "hl_testnet" {
  type        = string
  description = "Whether to use HyperLiquid testnet (e.g., 'true' or 'false')"
  default     = "false"
}

variable "telegram_bot_token" {
  type        = string
  description = "Telegram Bot Token for notifications"
  sensitive   = true
  default     = ""
}

variable "telegram_chat_id" {
  type        = string
  description = "Telegram Chat ID for notifications"
  default     = ""
}

variable "fix_stop_loss" {
  type        = string
  description = "Fixed USD amount to risk per trade (used to calculate position size)"
  default     = "3"
}

variable "telegram_enabled" {
  type        = string
  description = "Whether to enable Telegram notifications (true/false)"
  default     = "false"
}

variable "log_retention_days" {
  type        = number
  description = "Number of days to retain CloudWatch logs"
  default     = 7
}
