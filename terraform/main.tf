# Locals for stable configuration
locals {
  api_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "execute-api:Invoke"
        Resource  = "execute-api:/*"
      },
      {
        Effect    = "Deny"
        Principal = "*"
        Action    = "execute-api:Invoke"
        Resource  = "execute-api:/*"
        Condition = {
          NotIpAddress = {
            # TradingView IPs & potentially your own for testing
            "aws:SourceIp" = [
              "52.89.214.238/32",
              "34.212.75.30/32",
              "54.218.53.128/32",
              "52.32.178.7/32",
              "14.232.236.82/32"
            ]
          }
        }
      }
    ]
  })
}

# DynamoDB Table
resource "aws_dynamodb_table" "orders" {
  name         = "hl-orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = "production"
    Project     = "hyperliquid-bot"
  }
}

# SQS Queue
resource "aws_sqs_queue" "trade_signals" {
  name                       = "hl-trade-signals-queue"
  visibility_timeout_seconds = 60 # Lambda timeout should be less
  message_retention_seconds  = 86400
}

# IAM Role for Lambdas
resource "aws_iam_role" "lambda_exec" {
  name = "hl_lambda_exec_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_services_policy" {
  name = "hl_lambda_services_policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.trade_signals.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = aws_dynamodb_table.orders.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/hl/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_services_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_services_policy.arn
}

# Deployment Packages
locals {
  lambdas_zip_path    = abspath("${path.module}/../src/hyperliquid_python/dist/lambdas.zip")
  python_layer_path   = abspath("${path.module}/../src/hyperliquid_python/dist/python_layer.zip")
  lambdas_source_hash = filebase64sha256(local.lambdas_zip_path)
  python_layer_hash   = filebase64sha256(local.python_layer_path)
}

data "external" "build_info" {
  program = ["sh", "-c", "ls ../src/hyperliquid_python/dist/lambdas.zip > /dev/null && echo '{\"status\": \"ready\"}' || echo '{\"status\": \"missing\"}'"]
}

resource "aws_lambda_layer_version" "python_deps" {
  filename            = local.python_layer_path
  layer_name          = "hl-python-deps"
  source_code_hash    = local.python_layer_hash
  compatible_runtimes = ["python3.12"]
}

# Lambda 1: Gatekeeper
resource "aws_lambda_function" "gatekeeper" {
  function_name    = "hl-gatekeeper"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "functions.gatekeeper.handler"
  runtime          = "python3.12"
  filename         = local.lambdas_zip_path
  source_code_hash = local.lambdas_source_hash
  layers           = [aws_lambda_layer_version.python_deps.arn]

  environment {
    variables = {
      SQS_QUEUE_URL = aws_sqs_queue.trade_signals.url
    }
  }
}

resource "aws_cloudwatch_log_group" "gatekeeper" {
  name              = "/aws/lambda/${aws_lambda_function.gatekeeper.function_name}"
  retention_in_days = var.log_retention_days
}

# Lambda 2: Executor
resource "aws_lambda_function" "executor" {
  function_name    = "hl-executor"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "functions.executor.handler"
  runtime          = "python3.12"
  filename         = local.lambdas_zip_path
  source_code_hash = local.lambdas_source_hash
  layers           = [aws_lambda_layer_version.python_deps.arn]
  timeout          = 30

  environment {
    variables = {
      DYNAMODB_TABLE_NAME      = aws_dynamodb_table.orders.name
      HYPERLIQUID_USER_ADDRESS = var.hl_user_address
      HYPERLIQUID_TESTNET      = var.hl_testnet
      TELEGRAM_CHAT_ID         = var.telegram_chat_id
      FIX_STOPLOSS             = var.fix_stop_loss
      TELEGRAM_ENABLED         = var.telegram_enabled
      SSM_PRIVATE_KEY_PATH     = aws_ssm_parameter.hl_private_key.name
      SSM_TELEGRAM_TOKEN_PATH  = aws_ssm_parameter.telegram_bot_token.name
    }
  }
}

resource "aws_cloudwatch_log_group" "executor" {
  name              = "/aws/lambda/${aws_lambda_function.executor.function_name}"
  retention_in_days = var.log_retention_days
}

# SQS Trigger for Executor
resource "aws_lambda_event_source_mapping" "executor_sqs" {
  event_source_arn = aws_sqs_queue.trade_signals.arn
  function_name    = aws_lambda_function.executor.arn
  batch_size       = 1
}

# Lambda 3: Cleaner
resource "aws_lambda_function" "cleaner" {
  function_name    = "hl-cleaner"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "functions.cleaner.handler"
  runtime          = "python3.12"
  filename         = local.lambdas_zip_path
  source_code_hash = local.lambdas_source_hash
  layers           = [aws_lambda_layer_version.python_deps.arn]
  timeout          = 30

  environment {
    variables = {
      DYNAMODB_TABLE_NAME      = aws_dynamodb_table.orders.name
      HYPERLIQUID_USER_ADDRESS = var.hl_user_address
      HYPERLIQUID_TESTNET      = var.hl_testnet
      SSM_PRIVATE_KEY_PATH     = aws_ssm_parameter.hl_private_key.name
    }
  }
}

resource "aws_cloudwatch_log_group" "cleaner" {
  name              = "/aws/lambda/${aws_lambda_function.cleaner.function_name}"
  retention_in_days = var.log_retention_days
}

# EventBridge Trigger for Cleaner
resource "aws_cloudwatch_event_rule" "every_twelve_hours" {
  name                = "hl-every-twelve-hours"
  description         = "Fires every 12 hours"
  schedule_expression = "rate(12 hours)"
}

resource "aws_cloudwatch_event_target" "cleaner_target" {
  rule      = aws_cloudwatch_event_rule.every_twelve_hours.name
  target_id = "cleaner"
  arn       = aws_lambda_function.cleaner.arn
}

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cleaner.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_twelve_hours.arn
}

# API Gateway (REST API for finer IP control via Resource Policies)
resource "aws_api_gateway_rest_api" "webhook_api" {
  name        = "hl-webhook-api"
  description = "Webhook API for TradingView Signals"

  policy = local.api_policy
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id
  parent_id   = aws_api_gateway_rest_api.webhook_api.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.webhook_api.id
  resource_id   = aws_api_gateway_resource.webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_integration" {
  rest_api_id             = aws_api_gateway_rest_api.webhook_api.id
  resource_id             = aws_api_gateway_resource.webhook.id
  http_method             = aws_api_gateway_method.webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.gatekeeper.invoke_arn
}

resource "aws_api_gateway_deployment" "webhook_deploy" {
  rest_api_id = aws_api_gateway_rest_api.webhook_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.webhook.id,
      aws_api_gateway_method.webhook_post.id,
      aws_api_gateway_integration.webhook_integration.id,
      local.api_policy
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.webhook_deploy.id
  rest_api_id   = aws_api_gateway_rest_api.webhook_api.id
  stage_name    = "prod"
}

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.gatekeeper.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.webhook_api.execution_arn}/*/${aws_api_gateway_method.webhook_post.http_method}${aws_api_gateway_resource.webhook.path}"
}

