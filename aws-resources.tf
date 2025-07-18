# Terraform configuration for AWS resources
# Run: terraform init && terraform plan && terraform apply

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Provider for ACM certificates (required in us-east-1 for CloudFront)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
  default     = "Josh-Zirena/git-commit-ai"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "git-commit-ai"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "git-commit-ai.com"
}


# Secrets Manager for OpenAI API Key
resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = "${var.app_name}-openai-api-key"
  description             = "OpenAI API key for git-commit-ai"
  recovery_window_in_days = 7
}

# Secret version - you need to set this manually
resource "aws_secretsmanager_secret_version" "openai_api_key" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = "PLACEHOLDER_SET_VIA_AWS_CLI"
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}


# Default VPC and Subnets
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}




# GitHub OIDC Identity Provider
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}

# GitHub Actions Role
resource "aws_iam_role" "github_actions" {
  name = "${var.app_name}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
          }
        }
      }
    ]
  })
}

# GitHub Actions Role Policy
resource "aws_iam_role_policy" "github_actions_policy" {
  name = "${var.app_name}-github-actions-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.frontend.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:PutObjectAcl"
        ]
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation"
        ]
        Resource = aws_cloudfront_distribution.frontend.arn
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.backend_lambda.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# Random string for bucket names
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Data source for Route 53 hosted zone
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# ACM Certificate for HTTPS (must be in us-east-1 for CloudFront)
resource "aws_acm_certificate" "ssl_cert" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.app_name}-ssl-cert"
  }
}

# Certificate validation records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.ssl_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "ssl_cert" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.ssl_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# S3 bucket for frontend static website hosting
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.app_name}-frontend-${random_string.bucket_suffix.result}"

  tags = {
    Name = "${var.app_name}-frontend"
  }
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block (initially block all public access)
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Origin Access Control for CloudFront to access S3
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.app_name}-frontend-oac"
  description                       = "OAC for ${var.app_name} frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution for frontend
resource "aws_cloudfront_distribution" "frontend" {
  # S3 origin for static assets
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
    origin_id                = "S3-${aws_s3_bucket.frontend.bucket}"
  }


  # Lambda origin for API calls
  origin {
    domain_name = "${aws_api_gateway_rest_api.lambda_api.id}.execute-api.${var.aws_region}.amazonaws.com"
    origin_id   = "LAMBDA-${var.app_name}-api"
    origin_path = "/prod"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.app_name} frontend distribution"
  
  aliases = [var.domain_name, "www.${var.domain_name}"]

  # Default cache behavior for frontend assets
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600   # 1 hour
    max_ttl     = 86400  # 24 hours
  }

  # API cache behavior - Lambda
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "LAMBDA-${var.app_name}-api"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Authorization", "Content-Type", "X-Requested-With", "Accept"]

      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0  # Don't cache API responses
    max_ttl     = 0
  }





  # SPA routing - custom error response
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.ssl_cert.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Price class (optimize for cost vs performance)
  price_class = "PriceClass_100"

  tags = {
    Name = "${var.app_name}-frontend-distribution"
  }

  depends_on = [
    aws_s3_bucket.frontend
  ]
}

# S3 bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.frontend]
}

# Route 53 A record for the domain
resource "aws_route53_record" "root_domain" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  allow_overwrite = true

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route 53 AAAA record for IPv6
resource "aws_route53_record" "root_domain_ipv6" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "AAAA"
  allow_overwrite = true

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route 53 A record for www subdomain
resource "aws_route53_record" "www_domain" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  allow_overwrite = true

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route 53 AAAA record for www subdomain IPv6
resource "aws_route53_record" "www_domain_ipv6" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "AAAA"
  allow_overwrite = true

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# S3 bucket website configuration
resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # SPA routing - serve index.html for all routes
  }
}

# Outputs

output "github_actions_role_arn" {
  description = "GitHub Actions role ARN"
  value       = aws_iam_role.github_actions.arn
}

output "openai_secret_arn" {
  description = "OpenAI API key secret ARN"
  value       = aws_secretsmanager_secret.openai_api_key.arn
}


output "application_url" {
  description = "URL to access the application"
  value       = "https://${var.domain_name}"
}

output "s3_frontend_bucket" {
  description = "S3 bucket name for frontend static files"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

# Lambda Function for Serverless Backend
resource "aws_lambda_function" "backend_lambda" {
  filename         = "backend-lambda.zip"
  function_name    = "${var.app_name}-backend-lambda"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "dist/lambda.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 512
  source_code_hash = filebase64sha256("backend-lambda.zip")
  
  environment {
    variables = {
      NODE_ENV = "production"
      OPENAI_API_KEY = aws_secretsmanager_secret_version.openai_api_key.secret_string
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda,
  ]

  tags = {
    Name = "${var.app_name}-backend-lambda"
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.app_name}-backend-lambda"
  retention_in_days = 30

  tags = {
    Name = "${var.app_name}-lambda-logs"
  }
}

# Lambda Execution Role
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.app_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach basic Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda policy for secrets access
resource "aws_iam_role_policy" "lambda_secrets_policy" {
  name = "${var.app_name}-lambda-secrets-policy"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.openai_api_key.arn
      }
    ]
  })
}

# API Gateway REST API for Lambda
resource "aws_api_gateway_rest_api" "lambda_api" {
  name        = "${var.app_name}-lambda-api"
  description = "API Gateway for Lambda backend"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name = "${var.app_name}-lambda-api"
  }
}

# API Gateway Resource (proxy+)
resource "aws_api_gateway_resource" "lambda_proxy" {
  rest_api_id = aws_api_gateway_rest_api.lambda_api.id
  parent_id   = aws_api_gateway_rest_api.lambda_api.root_resource_id
  path_part   = "{proxy+}"
}

# API Gateway Method (ANY)
resource "aws_api_gateway_method" "lambda_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.lambda_api.id
  resource_id   = aws_api_gateway_resource.lambda_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration
resource "aws_api_gateway_integration" "lambda_proxy" {
  rest_api_id = aws_api_gateway_rest_api.lambda_api.id
  resource_id = aws_api_gateway_method.lambda_proxy.resource_id
  http_method = aws_api_gateway_method.lambda_proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.backend_lambda.invoke_arn
}

# API Gateway Method for root path
resource "aws_api_gateway_method" "lambda_root" {
  rest_api_id   = aws_api_gateway_rest_api.lambda_api.id
  resource_id   = aws_api_gateway_rest_api.lambda_api.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration for root path
resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.lambda_api.id
  resource_id = aws_api_gateway_method.lambda_root.resource_id
  http_method = aws_api_gateway_method.lambda_root.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.backend_lambda.invoke_arn
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "lambda_api" {
  depends_on = [
    aws_api_gateway_integration.lambda_proxy,
    aws_api_gateway_integration.lambda_root,
  ]

  rest_api_id = aws_api_gateway_rest_api.lambda_api.id

  # Trigger redeployment when API changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.lambda_proxy.id,
      aws_api_gateway_method.lambda_proxy.id,
      aws_api_gateway_method.lambda_root.id,
      aws_api_gateway_integration.lambda_proxy.id,
      aws_api_gateway_integration.lambda_root.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "lambda_api" {
  deployment_id = aws_api_gateway_deployment.lambda_api.id
  rest_api_id   = aws_api_gateway_rest_api.lambda_api.id
  stage_name    = "prod"
  description   = "Production stage for ${var.app_name} Lambda API"

  # CloudWatch logging disabled - requires API Gateway account settings

  # Enable X-Ray tracing
  xray_tracing_enabled = true

  tags = {
    Name        = "${var.app_name}-lambda-api-stage"
    Environment = "production"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.app_name}"
  retention_in_days = 30

  tags = {
    Name = "${var.app_name}-api-gateway-logs"
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.lambda_api.execution_arn}/*/*"
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs for Lambda deployment
output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.backend_lambda.function_name
}

output "lambda_api_gateway_url" {
  description = "API Gateway URL for Lambda backend"
  value       = "${aws_api_gateway_rest_api.lambda_api.execution_arn}/${aws_api_gateway_stage.lambda_api.stage_name}"
}

output "lambda_api_gateway_invoke_url" {
  description = "API Gateway invoke URL for Lambda backend"
  value       = "https://${aws_api_gateway_rest_api.lambda_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.lambda_api.stage_name}"
}