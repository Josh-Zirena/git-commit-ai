# API Documentation

This document describes the REST API endpoints for the AI Git Commit Generator.

## Base URL

```
http://localhost:3000  # Development
https://your-domain.com  # Production
```

## Authentication

The API does not require authentication for end users, but it does require a valid OpenAI API key to be configured on the server.

## Rate Limiting

- **Development**: 50 requests per minute per IP
- **Production**: 10 requests per minute per IP

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests per window
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: Time when the rate limit window resets

## Content Type

All API endpoints accept and return JSON with `Content-Type: application/json`.

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (API key issues)
- `404` - Not Found
- `413` - Request Entity Too Large
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Endpoints

### Health Check

Check if the API is running and healthy.

**GET** `/health`

#### Response

```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

#### Example

```bash
curl http://localhost:3000/health
```

---

### Generate Commit Message

Generate an AI-powered commit message based on a git diff.

**POST** `/api/generate-commit`

#### Request Body

```json
{
  "diff": "string (required) - The git diff content"
}
```

#### Success Response

```json
{
  "success": true,
  "commitMessage": "string - The generated commit message",
  "description": "string - Detailed description of the changes",
  "usage": {
    "prompt_tokens": "number - Tokens used for the prompt",
    "completion_tokens": "number - Tokens used for the completion",
    "total_tokens": "number - Total tokens used"
  }
}
```

#### Error Responses

**400 Bad Request - Missing diff**
```json
{
  "success": false,
  "error": "Git diff is required"
}
```

**400 Bad Request - Invalid diff format**
```json
{
  "success": false,
  "error": "Invalid git diff format",
  "details": [
    "Must start with 'diff --git'",
    "Must contain file change information"
  ]
}
```

**401 Unauthorized - API key issues**
```json
{
  "success": false,
  "error": "OpenAI API key is not configured or invalid"
}
```

**413 Request Entity Too Large**
```json
{
  "success": false,
  "error": "Request payload too large"
}
```

**429 Too Many Requests**
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

#### Examples

**Basic file modification:**

```bash
curl -X POST http://localhost:3000/api/generate-commit \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "diff --git a/src/utils/helper.ts b/src/utils/helper.ts\nindex 1234567..abcdefg 100644\n--- a/src/utils/helper.ts\n+++ b/src/utils/helper.ts\n@@ -1,3 +1,6 @@\n export function formatDate(date: Date): string {\n   return date.toISOString().split('\''T'\'')[0];\n }\n+\n+export function formatTime(date: Date): string {\n+  return date.toTimeString().split('\'' '\'')[0];\n+}"
  }'
```

**Response:**
```json
{
  "success": true,
  "commitMessage": "feat: add formatTime function to helper utilities",
  "description": "Added a new formatTime function that extracts the time portion from a Date object, complementing the existing formatDate function.",
  "usage": {
    "prompt_tokens": 145,
    "completion_tokens": 28,
    "total_tokens": 173
  }
}
```

**New file creation:**

```bash
curl -X POST http://localhost:3000/api/generate-commit \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "diff --git a/src/components/NewComponent.tsx b/src/components/NewComponent.tsx\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/src/components/NewComponent.tsx\n@@ -0,0 +1,10 @@\n+import React from '\''react'\'';\n+\n+interface Props {\n+  title: string;\n+}\n+\n+export function NewComponent({ title }: Props) {\n+  return <div>{title}</div>;\n+}\n+"
  }'
```

**Response:**
```json
{
  "success": true,
  "commitMessage": "feat: add NewComponent with title prop",
  "description": "Created a new React component that accepts a title prop and renders it in a div element.",
  "usage": {
    "prompt_tokens": 162,
    "completion_tokens": 22,
    "total_tokens": 184
  }
}
```

**Multiple files:**

```bash
curl -X POST http://localhost:3000/api/generate-commit \
  -H "Content-Type: application/json" \
  -d '{
    "diff": "diff --git a/src/components/Header.tsx b/src/components/Header.tsx\nindex 1234567..abcdefg 100644\n--- a/src/components/Header.tsx\n+++ b/src/components/Header.tsx\n@@ -1,5 +1,8 @@\n import React from '\''react'\'';\n \n export function Header() {\n-  return <h1>My App</h1>;\n+  return (\n+    <header>\n+      <h1>My Awesome App</h1>\n+    </header>\n+  );\n }\ndiff --git a/src/styles/main.css b/src/styles/main.css\nindex 9876543..fedcba9 100644\n--- a/src/styles/main.css\n+++ b/src/styles/main.css\n@@ -1,3 +1,7 @@\n body {\n   margin: 0;\n   font-family: Arial, sans-serif;\n+}\n+\n+header {\n+  background-color: #f0f0f0;\n }"
  }'
```

**Response:**
```json
{
  "success": true,
  "commitMessage": "feat: improve header styling and structure",
  "description": "Updated the Header component to use semantic HTML with proper header element and added background styling to improve visual appearance.",
  "usage": {
    "prompt_tokens": 198,
    "completion_tokens": 31,
    "total_tokens": 229
  }
}
```

---

### Error Handling

The API provides detailed error information to help with debugging:

**Invalid JSON:**
```bash
curl -X POST http://localhost:3000/api/generate-commit \
  -H "Content-Type: application/json" \
  -d '{"diff": invalid json}'
```

**Response:**
```json
{
  "success": false,
  "error": "Invalid JSON in request body"
}
```

**Missing Content-Type:**
```bash
curl -X POST http://localhost:3000/api/generate-commit \
  -d 'diff=some-diff'
```

**Response:**
```json
{
  "success": false,
  "error": "Content-Type must be application/json"
}
```

---

## Git Diff Format Requirements

The API validates git diff format and requires:

1. **Must start with `diff --git`**
2. **Must contain file paths**
3. **Must have index line**
4. **Must have file markers (`---` and `+++`)**
5. **Must have change hunks (`@@` lines)**

### Valid Diff Examples

**File modification:**
```
diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3
```

**New file:**
```
diff --git a/newfile.txt b/newfile.txt
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3
```

**Deleted file:**
```
diff --git a/oldfile.txt b/oldfile.txt
deleted file mode 100644
index 1234567..0000000
--- a/oldfile.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3
```

**File rename:**
```
diff --git a/old-name.txt b/new-name.txt
similarity index 100%
rename from old-name.txt
rename to new-name.txt
```

**Binary file:**
```
diff --git a/image.png b/image.png
index 1234567..abcdefg 100644
GIT binary patch
delta 123
zcmV-?0F>m-;1`1rOp{oq0R9-x...
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
interface CommitGeneratorResponse {
  success: boolean;
  commitMessage?: string;
  description?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

class CommitGeneratorAPI {
  constructor(private baseUrl: string = 'http://localhost:3000') {}

  async generateCommit(diff: string): Promise<CommitGeneratorResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate-commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ diff }),
    });

    return await response.json();
  }

  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return await response.json();
  }
}

// Usage
const api = new CommitGeneratorAPI();
const result = await api.generateCommit(gitDiff);
console.log(result.commitMessage);
```

### Python

```python
import requests
import json

class CommitGeneratorAPI:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def generate_commit(self, diff: str) -> dict:
        response = requests.post(
            f"{self.base_url}/api/generate-commit",
            headers={"Content-Type": "application/json"},
            json={"diff": diff}
        )
        return response.json()
    
    def health_check(self) -> dict:
        response = requests.get(f"{self.base_url}/health")
        return response.json()

# Usage
api = CommitGeneratorAPI()
result = api.generate_commit(git_diff)
print(result["commitMessage"])
```

### cURL

```bash
#!/bin/bash

# Function to generate commit message
generate_commit() {
  local diff="$1"
  curl -s -X POST http://localhost:3000/api/generate-commit \
    -H "Content-Type: application/json" \
    -d "{\"diff\": \"$diff\"}" | \
    jq -r '.commitMessage'
}

# Usage
git_diff=$(git diff --staged)
commit_message=$(generate_commit "$git_diff")
echo "Generated commit message: $commit_message"
```

---

## Performance Considerations

### Request Size Limits

- **Maximum payload size**: 2MB
- **Typical git diff size**: Most diffs are under 100KB
- **Large diffs**: Consider splitting large changes into smaller commits

### Response Times

- **Typical response time**: 2-5 seconds
- **Factors affecting speed**: 
  - Diff size and complexity
  - OpenAI API response time
  - Server load

### Caching

- **No built-in caching**: Each request generates a new commit message
- **Client-side caching**: Recommended for repeated requests
- **CDN caching**: Not recommended due to dynamic content

---

## Monitoring and Debugging

### Health Check Endpoint

Use the health endpoint for:
- Uptime monitoring
- Load balancer health checks
- Service discovery

### Request Logging

All requests are logged with:
- Timestamp
- HTTP method and path
- User agent
- Response status code

### Error Tracking

Common error scenarios and their resolutions:

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid OpenAI API key | Check environment variables |
| 429 Too Many Requests | Rate limit exceeded | Implement request queuing |
| 413 Entity Too Large | Diff too large | Split into smaller commits |
| 500 Internal Server Error | Server configuration issue | Check server logs |

---

## Migration Guide

### From v1.0.0 to v1.1.0

No breaking changes expected. New features will be additive.

### API Versioning

Currently, the API does not use versioning. Future versions may introduce:
- Version headers
- Versioned endpoints (`/api/v2/generate-commit`)
- Backward compatibility guarantees