const SENSITIVE_PATTERNS: RegExp[] = [
  // 环境变量式密钥 (API_KEY, TOKEN, SECRET, PASSWORD, KEY, PRIVATE)
  /[A-Z_][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|KEY|PRIVATE)[_\s]*[=:]\s*['"]?([a-zA-Z0-9_/-]{8,})['"]?/gi,
  // OpenAI sk- key
  /sk-[a-zA-Z0-9]{20,}/g,
  // GitHub tokens
  /gh[pousr]_[a-zA-Z0-9]{36}/g,
  // GitLab tokens
  /glpat-[a-zA-Z0-9_-]{20,}/gi,
  // Bearer token
  /Bearer\s+[a-zA-Z0-9_.-]+/gi,
  // AWS access key
  /AKIA[0-9A-Z]{16}/g,
  // AWS secret key (40 char base64)
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  // Generic "password" in quotes
  /["']?(?:password|passwd|pwd)["']?\s*[=:]\s*["']?[^\s'"]{4,}["']?/gi,
  // Generic "secret" in quotes
  /["']?(?:secret)["']?\s*[=:]\s*["']?[^\s'"]{4,}["']?/gi,
  // JWT token
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
  // Private key header
  /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
  // Generic API key pattern (long alphanumeric strings that look like keys)
  /[a-zA-Z0-9]{32,}(?=\s|$|['",;])/g,
]

const REDACTED = '***REDACTED***'

export function sanitize(content: string): string {
  if (!content) return content

  let result = content

  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACTED)
  }

  return result
}

export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()

    if (
      lowerKey.includes('key') ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('auth')
    ) {
      result[key] = REDACTED
    } else if (typeof value === 'string') {
      result[key] = sanitize(value)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}
