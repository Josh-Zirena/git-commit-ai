# Dual Deployment Setup - ECS + Lambda

This project now supports **dual deployment** - you can run the same backend API via both AWS ECS (containers) and AWS Lambda (serverless).

## Architecture Overview

### Current Setup
- **Frontend**: React app deployed to S3 + CloudFront (unchanged)
- **Backend Option 1**: Express server on ECS Fargate + ALB (existing)
- **Backend Option 2**: Express server on Lambda + API Gateway (new)

Both backends serve identical APIs and functionality.

## Deployment Instructions

### 1. Install Lambda Dependencies

```bash
cd backend
npm install @codegenie/serverless-express@^4.16.0 --save
npm install @types/aws-lambda@^8.10.150 --save-dev
```

### 2. Deploy Infrastructure

```bash
# Deploy both ECS and Lambda resources
terraform plan
terraform apply
```

This creates:
- **Existing**: ECS cluster, ALB, ECR repository
- **New**: Lambda function, API Gateway, IAM roles

### 3. GitHub Actions Deployment

The workflow now includes both deployment jobs:
- `deploy-backend`: ECS deployment (existing)
- `deploy-lambda`: Lambda deployment (new)

Both run in parallel after tests pass.

### 4. Required GitHub Secrets

Add these new secrets to your repository:
- `LAMBDA_FUNCTION_NAME`: `git-commit-ai-backend-lambda` (or use default)

Existing secrets remain the same.

## Usage

### ECS Endpoint (existing)
```
https://your-domain.com/api/generate-commit
```

### Lambda Endpoint (new)
```
https://api-gateway-id.execute-api.us-east-1.amazonaws.com/prod/api/generate-commit
```

## Benefits of Dual Deployment

### ECS Use Cases
- Always-on availability
- Consistent performance
- Complex, long-running requests
- Persistent connections

### Lambda Use Cases  
- Cost optimization for low traffic
- Auto-scaling for burst traffic
- Pay-per-request pricing
- Zero infrastructure management

## File Changes Made

### New Files
- `backend/src/lambda.ts` - Lambda handler entry point
- `DEPLOYMENT.md` - This documentation

### Modified Files
- `backend/package.json` - Added Lambda dependencies
- `backend/src/index.ts` - Conditional server startup (no Lambda conflicts)
- `aws-resources.tf` - Added Lambda infrastructure resources
- `.github/workflows/deploy.yml` - Added Lambda deployment job

### Key Technical Details

1. **Shared Codebase**: Both deployments use identical Express app and business logic
2. **Environment Detection**: Server startup is conditional based on Lambda environment
3. **Modern Dependencies**: Uses `@codegenie/serverless-express` (replaces deprecated `@vendia/serverless-express`)
4. **Independent Scaling**: Each deployment can scale independently
5. **Parallel CI/CD**: Both deployments happen simultaneously

## Testing

Run tests locally to verify both configurations work:

```bash
# Test ECS configuration (standard Express server)
cd backend
npm run dev

# Test Lambda configuration (requires AWS SAM or serverless-offline for local testing)
# Or deploy and test via API Gateway URL
```

## Cost Optimization

- **Low traffic**: Route to Lambda for cost savings
- **High traffic**: Route to ECS for consistent performance  
- **A/B testing**: Split traffic between deployments
- **Failover**: Use one as backup for the other

## Next Steps

1. Deploy infrastructure: `terraform apply`
2. Push to main branch to trigger deployments
3. Test both endpoints work correctly
4. Configure traffic routing as needed (optional)