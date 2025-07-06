import { validateGitDiff, isValidGitDiff, getValidationErrors } from '../../src/utils/validation';

describe('Git Diff Validation', () => {
  describe('validateGitDiff', () => {
    describe('Valid git diffs', () => {
      test('should validate basic git diff with diff --git header', () => {
        const validDiff = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should validate git diff with hunk headers only', () => {
        const validDiff = `@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should validate git diff with multiple hunks', () => {
        const validDiff = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line
 line 3
@@ -10,2 +11,3 @@
 another line
+another new line
 last line`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should validate git diff with file deletions', () => {
        const validDiff = `diff --git a/file.txt b/file.txt
index 1234567..abcdefg 100644
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,2 @@
 line 1
-deleted line
 line 3`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should validate git diff with new file creation', () => {
        const validDiff = `diff --git a/newfile.txt b/newfile.txt
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should validate git diff with file deletion', () => {
        const validDiff = `diff --git a/oldfile.txt b/oldfile.txt
deleted file mode 100644
index 1234567..0000000
--- a/oldfile.txt
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Invalid inputs', () => {
      test('should reject null input', () => {
        const result = validateGitDiff(null as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input must be a non-empty string');
      });

      test('should reject undefined input', () => {
        const result = validateGitDiff(undefined as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input must be a non-empty string');
      });

      test('should reject empty string', () => {
        const result = validateGitDiff('');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input must be a non-empty string');
      });

      test('should reject whitespace-only string', () => {
        const result = validateGitDiff('   \n\t  ');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input cannot be empty or contain only whitespace');
      });

      test('should reject non-string input', () => {
        const result = validateGitDiff(123 as any);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input must be a non-empty string');
      });

      test('should reject random text without git diff indicators', () => {
        const result = validateGitDiff('This is just random text\nwith multiple lines\nbut no git diff markers');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input does not appear to be a valid git diff (missing diff --git header or @@ hunk headers)');
      });

      test('should reject input with suspicious JavaScript content', () => {
        const maliciousInput = `diff --git a/file.txt b/file.txt
<script>alert('xss')</script>
@@ -1,1 +1,1 @@
-old line
+new line`;

        const result = validateGitDiff(maliciousInput);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input contains potentially malicious content');
      });

      test('should reject input with javascript: protocol', () => {
        const maliciousInput = `diff --git a/file.txt b/file.txt
javascript:alert('xss')
@@ -1,1 +1,1 @@
-old line
+new line`;

        const result = validateGitDiff(maliciousInput);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input contains potentially malicious content');
      });

      test('should reject binary file diffs by default', () => {
        const binaryDiff = `diff --git a/image.png b/image.png
index 1234567..abcdefg 100644
Binary files a/image.png and b/image.png differ`;

        const result = validateGitDiff(binaryDiff);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Binary file diffs are not allowed');
      });
    });

    describe('Edge cases', () => {
      test('should reject input that exceeds maximum size', () => {
        const largeInput = 'a'.repeat(1000) + '\n@@ -1,1 +1,1 @@\n-old\n+new';
        const result = validateGitDiff(largeInput, { maxSize: 500 });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Input size exceeds maximum allowed size of 500 characters');
      });

      test('should allow binary files when option is enabled', () => {
        const binaryDiff = `diff --git a/image.png b/image.png
index 1234567..abcdefg 100644
Binary files a/image.png and b/image.png differ`;

        const result = validateGitDiff(binaryDiff, { allowBinaryFiles: true });
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should handle git diff with no actual changes', () => {
        const noChangeDiff = `diff --git a/file.txt b/file.txt
index 1234567..1234567 100644
--- a/file.txt
+++ b/file.txt`;

        const result = validateGitDiff(noChangeDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should handle git diff with context lines only', () => {
        const contextOnlyDiff = `@@ -1,3 +1,3 @@
 line 1
 line 2
 line 3`;

        const result = validateGitDiff(contextOnlyDiff);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Options handling', () => {
      test('should use default options when none provided', () => {
        const validDiff = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;

        const result = validateGitDiff(validDiff);
        expect(result.isValid).toBe(true);
      });

      test('should merge provided options with defaults', () => {
        const validDiff = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;

        const result = validateGitDiff(validDiff, { maxSize: 500 });
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('isValidGitDiff', () => {
    test('should return true for valid git diff', () => {
      const validDiff = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;

      expect(isValidGitDiff(validDiff)).toBe(true);
    });

    test('should return false for invalid git diff', () => {
      expect(isValidGitDiff('not a git diff')).toBe(false);
    });

    test('should accept options', () => {
      const validDiff = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;

      expect(isValidGitDiff(validDiff, { maxSize: 500 })).toBe(true);
    });
  });

  describe('getValidationErrors', () => {
    test('should return empty array for valid git diff', () => {
      const validDiff = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;

      const errors = getValidationErrors(validDiff);
      expect(errors).toHaveLength(0);
    });

    test('should return error messages for invalid git diff', () => {
      const errors = getValidationErrors('not a git diff');
      expect(errors).toContain('Input does not appear to be a valid git diff (missing diff --git header or @@ hunk headers)');
    });

    test('should accept options', () => {
      const largeInput = 'a'.repeat(1000);
      const errors = getValidationErrors(largeInput, { maxSize: 500 });
      expect(errors).toContain('Input size exceeds maximum allowed size of 500 characters');
    });
  });

  describe('Function purity', () => {
    test('validation functions should be pure (no side effects)', () => {
      const input = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;

      // Test that multiple calls with same input return same result
      const result1 = validateGitDiff(input);
      const result2 = validateGitDiff(input);
      
      expect(result1).toEqual(result2);
      expect(result1.isValid).toBe(result2.isValid);
      expect(result1.errors).toEqual(result2.errors);

      // Test that the input is not modified
      const originalInput = input;
      validateGitDiff(input);
      expect(input).toBe(originalInput);

      // Test isValidGitDiff purity
      expect(isValidGitDiff(input)).toBe(isValidGitDiff(input));

      // Test getValidationErrors purity
      const errors1 = getValidationErrors(input);
      const errors2 = getValidationErrors(input);
      expect(errors1).toEqual(errors2);
    });

    test('should not modify input or options objects', () => {
      const input = `diff --git a/file.txt b/file.txt
@@ -1,1 +1,1 @@
-old line
+new line`;
      
      const options = { maxSize: 1000, allowBinaryFiles: false };
      const originalOptions = { ...options };
      
      validateGitDiff(input, options);
      
      expect(options).toEqual(originalOptions);
    });
  });
});