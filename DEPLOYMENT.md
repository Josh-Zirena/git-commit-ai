# ECS Deployment Guide

This guide helps you migrate from SSH-based EC2 deployment to modern ECS with GitHub Actions OIDC.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Terraform installed** (optional, for infrastructure as code)
3. **GitHub repository** with admin access

## Step 1: Deploy AWS Infrastructure

### Option A: Using Terraform (Recommended)

1. **Update variables** in `aws-resources.tf`:
   ```bash
   # Edit the file and update these variables:
   variable "github_repo" {
     default = "YOUR_GITHUB_USERNAME/git-commit-ai"
   }
   ```

2. **Deploy infrastructure**:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

3. **Note the outputs** - you'll need these for GitHub secrets:
   ```bash
   terraform output
   ```

### Option B: Manual Setup (using AWS Console)

Follow the instructions in `aws-setup.md` to manually create:
- GitHub OIDC Identity Provider
- IAM Role for GitHub Actions
- ECR Repository
- ECS Cluster and Service

## Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

1. **AWS_ROLE_ARN**: The ARN of the GitHub Actions IAM role
   ```
   arn:aws:iam::YOUR_ACCOUNT_ID:role/git-commit-ai-github-actions-role
   ```

2. **OPENAI_API_KEY**: Your OpenAI API key (keep existing)

## Step 3: Set OpenAI API Key in AWS Secrets Manager

```bash
aws secretsmanager put-secret-value \
  --secret-id git-commit-ai-openai-api-key \
  --secret-string "YOUR_OPENAI_API_KEY"
```

## Step 4: Update GitHub Actions Workflow

1. **Rename old workflow** (to keep as backup):
   ```bash
   mv .github/workflows/deploy.yml .github/workflows/deploy-ec2-backup.yml
   ```

2. **Rename new workflow**:
   ```bash
   mv .github/workflows/deploy-ecs.yml .github/workflows/deploy.yml
   ```

3. **Commit and push** to trigger deployment:
   ```bash
   git add .
   git commit -m "feat: migrate to ECS deployment with OIDC"
   git push origin main
   ```

## Step 5: Monitor Deployment

1. **Watch GitHub Actions**: Check the Actions tab in your repository
2. **Monitor ECS**: Check ECS console for service status
3. **Check logs**: View CloudWatch logs for application logs

## Step 6: Access Your Application

After successful deployment, your application will be accessible via:
- **ECS Service**: Check the ECS service for the public IP
- **Optional**: Set up an Application Load Balancer for a custom domain

## Troubleshooting

### Common Issues

1. **OIDC Trust Policy**: Ensure the repository name matches exactly
2. **ECR Permissions**: Verify the GitHub role has ECR push permissions
3. **ECS Task Role**: Ensure the task execution role has Secrets Manager access

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster git-commit-ai --services git-commit-ai

# View CloudWatch logs
aws logs tail /ecs/git-commit-ai --follow

# Check task definition
aws ecs describe-task-definition --task-definition git-commit-ai
```

## Security Benefits

✅ **No SSH keys** - Uses OIDC for authentication  
✅ **No IP whitelisting** - Uses AWS IAM roles  
✅ **Managed infrastructure** - ECS handles scaling and health checks  
✅ **Encrypted secrets** - Uses AWS Secrets Manager  
✅ **Audit trail** - All actions logged in CloudTrail  

## Cost Optimization

- **Fargate Spot**: Use spot instances for development
- **Auto Scaling**: Configure CPU/memory-based scaling
- **Scheduled Scaling**: Scale down during off-hours

## Next Steps

1. **Set up Application Load Balancer** for custom domain
2. **Configure auto-scaling** based on CPU/memory
3. **Set up monitoring** with CloudWatch alarms
4. **Implement blue/green deployments** for zero downtime

## Cleanup

To remove all resources:
```bash
terraform destroy
```

Or manually delete the ECS service, cluster, ECR repository, and IAM resources.