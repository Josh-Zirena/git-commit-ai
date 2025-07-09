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
  // For a developer tool, we need to be very careful about what we consider "suspicious"
  // Focus on actual security threats, not legitimate code patterns
  
  // Check if this appears to be a legitimate code file diff
  const isLegitimateCodeFile = isCodeFileDiff(input);
  
  // If it's a legitimate code file, only check for very specific security threats
  if (isLegitimateCodeFile) {
    return containsActualSecurityThreats(input);
  }
  
  // For non-code files (like plain text, config files, etc.), be more restrictive
  return containsGeneralSuspiciousPatterns(input);
}

function isCodeFileDiff(input: string): boolean {
  // Check for common code file extensions
  const hasCodeFileExtension = /\.(js|ts|jsx|tsx|py|java|cpp|c|h|cs|php|rb|go|rs|kt|swift|scala|clj|hs|elm|dart|vue|svelte)$/m.test(input);
  
  // Check for common infrastructure/config file extensions
  const hasInfraFileExtension = /\.(tf|yml|yaml|json|toml|ini|cfg|conf|dockerfile|makefile)$/mi.test(input);
  
  // Check for common programming language indicators
  const hasCodeIndicators = [
    /\bfunction\s+\w+\s*\(/,
    /\bconst\s+\w+\s*=/,
    /\blet\s+\w+\s*=/,
    /\bvar\s+\w+\s*=/,
    /\bimport\s+.*\s+from\s+/,
    /\bexport\s+(default\s+)?/,
    /\binterface\s+\w+/,
    /\btype\s+\w+\s*=/,
    /\bclass\s+\w+/,
    /\bdef\s+\w+\s*\(/,
    /\bpublic\s+\w+/,
    /\bprivate\s+\w+/,
    /\bresource\s+"/,
    /\bprovider\s+"/,
    /\bvariable\s+"/,
  ].some(pattern => pattern.test(input));
  
  return hasCodeFileExtension || hasInfraFileExtension || hasCodeIndicators;
}

function containsActualSecurityThreats(input: string): boolean {
  // Only flag actual security threats in code files
  const securityThreats = [
    // Actual script injection attempts (not legitimate code)
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    
    // Dangerous eval patterns with dynamic content (but allow legitimate eval in code)
    /eval\s*\(\s*["'`][^"'`]*["'`]\s*\)/gi,
    
    // Actual DOM manipulation that could be XSS
    /document\.write\s*\(\s*["'`][^"'`]*<script/gi,
    
    // Suspicious redirects with javascript protocol
    /window\.location\s*=\s*["'`]javascript:/gi,
    
    // SQL injection attempts (be more specific)
    /;\s*(DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE|ALTER\s+TABLE)\s+/gi,
    
    // Command injection attempts (be more specific)
    /;\s*(rm\s+-rf|del\s+\/|format\s+c:|shutdown\s+\/|reboot\s+\/)\s+/gi,
  ];
  
  return securityThreats.some(pattern => pattern.test(input));
}

function containsGeneralSuspiciousPatterns(input: string): boolean {
  // For non-code files, be more restrictive
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /eval\s*\(/gi,
    /document\.write/gi,
    /window\.location/gi,
    /\.innerHTML/gi,
    /on\w+\s*=/gi,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(input));
}

export function isValidGitDiff(input: string, options?: GitDiffValidationOptions): boolean {
  return validateGitDiff(input, options).isValid;
}

export function getValidationErrors(input: string, options?: GitDiffValidationOptions): string[] {
  return validateGitDiff(input, options).errors;
}