import request from 'supertest';
import app from '../src/index';

describe('End-to-End Tests', () => {
  const API_BASE = '/api';

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
        version: '1.0.0'
      });
    });
  });

  describe('Generate Commit Message API', () => {
    const validDiff = `diff --git a/src/utils/helper.ts b/src/utils/helper.ts
index 1234567..abcdefg 100644
--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1,3 +1,6 @@
 export function formatDate(date: Date): string {
   return date.toISOString().split('T')[0];
 }
+
+export function formatTime(date: Date): string {
+  return date.toTimeString().split(' ')[0];
+}`;

    it('should generate commit message for valid diff', async () => {
      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: validDiff })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        commitMessage: expect.any(String),
        description: expect.any(String),
        usage: expect.objectContaining({
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          totalTokens: expect.any(Number)
        })
      });

      expect(response.body.commitMessage).toBeTruthy();
      expect(response.body.description).toBeTruthy();
    });

    it('should handle missing diff parameter', async () => {
      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Git diff is required',
        success: false
      });
    });

    it('should handle empty diff parameter', async () => {
      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: '' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Git diff is required',
        success: false
      });
    });

    it('should handle invalid diff format', async () => {
      const invalidDiff = 'This is not a valid git diff';
      
      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: invalidDiff })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid git diff format',
        details: expect.any(Array),
        success: false
      });
    });

    it('should handle very large diff payload', async () => {
      const largeDiff = 'diff --git a/largefile.txt b/largefile.txt\n' +
        'index 1234567..abcdefg 100644\n' +
        '--- a/largefile.txt\n' +
        '+++ b/largefile.txt\n' +
        '@@ -1,1 +1,1 @@\n' +
        '-old content\n' +
        '+' + 'x'.repeat(3 * 1024 * 1024); // 3MB of content

      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: largeDiff })
        .expect(413);

      expect(response.body).toEqual({
        error: 'Request payload too large',
        success: false
      });
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests rapidly to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 60; i++) {
        requests.push(
          request(app)
            .post(`${API_BASE}/generate-commit`)
            .send({ diff: validDiff })
        );
      }

      const responses = await Promise.all(requests);
      
      // At least one request should be rate limited (or return 401 due to missing API key)
      const rateLimited = responses.some(response => response.status === 429 || response.status === 401);
      expect(rateLimited).toBe(true);
    }, 30000);

    it('should handle complex diff with multiple files', async () => {
      const multiFileDiff = `diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 1234567..abcdefg 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,5 +1,8 @@
 import React from 'react';
 
 export function Header() {
-  return <h1>My App</h1>;
+  return (
+    <header>
+      <h1>My Awesome App</h1>
+    </header>
+  );
 }
diff --git a/src/styles/main.css b/src/styles/main.css
index 9876543..fedcba9 100644
--- a/src/styles/main.css
+++ b/src/styles/main.css
@@ -1,3 +1,7 @@
 body {
   margin: 0;
   font-family: Arial, sans-serif;
+}
+
+header {
+  background-color: #f0f0f0;
 }`;

      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: multiFileDiff })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.commitMessage).toBeTruthy();
    });

    it('should handle diff with binary files', async () => {
      const binaryDiff = `diff --git a/assets/logo.png b/assets/logo.png
index 1234567..abcdefg 100644
GIT binary patch
delta 123
zcmV-binary-data-here
delta 456
zcmV-more-binary-data

diff --git a/src/utils/constants.ts b/src/utils/constants.ts
index 7890123..4567890 100644
--- a/src/utils/constants.ts
+++ b/src/utils/constants.ts
@@ -1,2 +1,3 @@
 export const APP_NAME = 'My App';
 export const VERSION = '1.0.0';
+export const LOGO_PATH = '/assets/logo.png';`;

      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: binaryDiff })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.commitMessage).toBeTruthy();
    });
  });

  describe('404 Error Handling', () => {
    it('should return 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get(`${API_BASE}/non-existent-endpoint`)
        .expect(404);

      expect(response.body).toEqual({
        error: 'API endpoint not found',
        success: false
      });
    });

    it('should return 404 for non-existent static pages', async () => {
      await request(app)
        .get('/non-existent-page')
        .expect(404);
    });
  });

  describe('CORS and Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options(`${API_BASE}/generate-commit`)
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Content-Type Handling', () => {
    it('should require JSON content type', async () => {
      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('diff=invalid');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .set('Content-Type', 'application/json')
        .send('{"diff": invalid json}');
        
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Real-world Git Diff Examples', () => {
    it('should handle file addition', async () => {
      const addFileDiff = `diff --git a/src/components/NewComponent.tsx b/src/components/NewComponent.tsx
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/components/NewComponent.tsx
@@ -0,0 +1,10 @@
+import React from 'react';
+
+interface Props {
+  title: string;
+}
+
+export function NewComponent({ title }: Props) {
+  return <div>{title}</div>;
+}
+`;

      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: addFileDiff })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle file deletion', async () => {
      const deleteFileDiff = `diff --git a/src/components/OldComponent.tsx b/src/components/OldComponent.tsx
deleted file mode 100644
index 1234567..0000000
--- a/src/components/OldComponent.tsx
+++ /dev/null
@@ -1,5 +0,0 @@
-import React from 'react';
-
-export function OldComponent() {
-  return <div>Old Component</div>;
-}`;

      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: deleteFileDiff })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle file rename', async () => {
      const renameFileDiff = `diff --git a/src/components/Component.tsx b/src/components/RenamedComponent.tsx
similarity index 70%
rename from src/components/Component.tsx
rename to src/components/RenamedComponent.tsx
index 1234567..abcdefg 100644
--- a/src/components/Component.tsx
+++ b/src/components/RenamedComponent.tsx
@@ -1,5 +1,5 @@
 import React from 'react';
 
-export function Component() {
+export function RenamedComponent() {
   return <div>Component</div>;
 }`;

      const response = await request(app)
        .post(`${API_BASE}/generate-commit`)
        .send({ diff: renameFileDiff })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});