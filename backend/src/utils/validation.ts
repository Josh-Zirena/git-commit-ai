export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface GitDiffValidationOptions {
  maxSize?: number;
  allowBinaryFiles?: boolean;
}

const DEFAULT_OPTIONS: GitDiffValidationOptions = {
  maxSize: 10 * 1024 * 1024, // 10MB - increased for large diff handling
  allowBinaryFiles: false, // Reject binary files by default for security
};

export function validateGitDiff(
  input: string,
  options: GitDiffValidationOptions = DEFAULT_OPTIONS
): ValidationResult {
  const errors: string[] = [];

  // Check if input is empty or null
  if (!input || typeof input !== 'string') {
    errors.push('Input must be a non-empty string');
    return { isValid: false, errors };
  }

  // Check input size
  if (options.maxSize && input.length > options.maxSize) {
    errors.push(`Input size exceeds maximum allowed size of ${options.maxSize} characters`);
    return { isValid: false, errors };
  }

  // Trim whitespace for processing
  const trimmedInput = input.trim();
  
  if (trimmedInput.length === 0) {
    errors.push('Input cannot be empty or contain only whitespace');
    return { isValid: false, errors };
  }

  // Check for git diff header indicators (use multiline flag)
  const hasGitDiffHeader = /^diff --git/m.test(trimmedInput);
  const hasIndexLine = /^index [a-f0-9]+\.\.[a-f0-9]+/m.test(trimmedInput);
  const hasFilePathIndicators = /^(---|\+\+\+) [^\t\n\r]+/m.test(trimmedInput);
  const hasHunkHeaders = /^@@ -\d+,?\d* \+\d+,?\d* @@/m.test(trimmedInput);
  
  // Check for actual diff content (lines starting with +, -, or space)
  const hasDiffContent = /^[+\-\s]/.test(trimmedInput.split('\n').slice(1).join('\n'));

  // Must have at least one of the primary git diff indicators
  if (!hasGitDiffHeader && !hasHunkHeaders) {
    errors.push('Input does not appear to be a valid git diff (missing diff --git header or @@ hunk headers)');
  }

  // Check for binary file indicators
  if (!options.allowBinaryFiles) {
    if (/^Binary files? .+ differ$/m.test(trimmedInput)) {
      errors.push('Binary file diffs are not allowed');
    }
  }

  // Check for suspicious content that might indicate malicious input
  if (containsSuspiciousContent(trimmedInput)) {
    errors.push('Input contains potentially malicious content');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function containsSuspiciousContent(input: string): boolean {
  // Check if this appears to be a React/JSX file diff
  const isReactFile = /\.(jsx?|tsx?)$/m.test(input) || 
                     input.includes('className=') ||
                     input.includes('export default function') ||
                     input.includes('React') ||
                     input.includes('useState') ||
                     input.includes('useEffect');

  // Check for common script injection patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /eval\s*\(/gi,
    /document\.write/gi,
    /window\.location/gi,
    /\.innerHTML/gi,
  ];

  // If it's a React file, be more permissive with event handlers
  if (!isReactFile) {
    suspiciousPatterns.push(/on\w+\s*=/gi);
  }

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

export function isValidGitDiff(input: string, options?: GitDiffValidationOptions): boolean {
  return validateGitDiff(input, options).isValid;
}

export function getValidationErrors(input: string, options?: GitDiffValidationOptions): string[] {
  return validateGitDiff(input, options).errors;
}