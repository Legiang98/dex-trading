output "api_gateway_webhook_url" {
  value       = "${aws_api_gateway_stage.prod.invoke_url}/webhook"
  description = "The webhook URL to configure in TradingView"
}

output "sqs_queue_url" {
  value       = aws_sqs_queue.trade_signals.url
  description = "The SQS Queue URL"
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.orders.name
  description = "The DynamoDB table name"
}
