
resource "aws_ssm_parameter" "hl_private_key" {
  name  = "/hl/private_key"
  type  = "SecureString"
  value = var.hl_private_key

  tags = {
    Environment = "prod"
    Project     = "Hyperliquid"
  }
}

resource "aws_ssm_parameter" "telegram_bot_token" {
  name  = "/hl/telegram_bot_token"
  type  = "SecureString"
  value = var.telegram_bot_token

  tags = {
    Environment = "prod"
    Project     = "Hyperliquid"
  }
}
