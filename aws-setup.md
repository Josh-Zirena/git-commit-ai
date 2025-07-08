# AWS Setup for GitHub Actions OIDC Deployment

## 1. Create GitHub OIDC Identity Provider

Go to IAM → Identity providers → Add provider:

- **Provider type**: OpenID Connect
- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`
- **Thumbprint**: Click "Get thumbprint" (automatically populated)

## 2. Create IAM Role for GitHub Actions

### Trust Policy (replace YOUR_GITHUB_USERNAME and YOUR_REPO_NAME):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/git-commit-ai:*"
        }
      }
    }
  ]
}
```

### IAM Permissions Policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

## 3. Role Configuration

- **Role name**: `GitHubActionsRole`
- **Description**: `Role for GitHub Actions to deploy to ECS`
- **Trust policy**: Use the trust policy above
- **Permissions**: Create custom policy with permissions above

## 4. Get Your AWS Account ID

Run: `aws sts get-caller-identity --query Account --output text`

## Next Steps

After creating the OIDC provider and role, we'll:
1. Create ECR repository
2. Set up ECS cluster and service
3. Update GitHub Actions workflow