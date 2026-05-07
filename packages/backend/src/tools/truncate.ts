import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'

const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024 // 50KB
const TRUNCATE_DIR = path.join(os.tmpdir(), 'yishan-tools-truncate')

export interface TruncateResult {
  content: string
  truncated: boolean
  outputPath?: string
}

function ensureTruncateDir(): void {
  if (!fs.existsSync(TRUNCATE_DIR)) {
    fs.mkdirSync(TRUNCATE_DIR, { recursive: true })
  }
}

export function truncateOutput(
  content: string,
  maxLines = MAX_LINES,
  maxBytes = MAX_BYTES
): TruncateResult {
  if (!content) {
    return { content, truncated: false }
  }

  const lines = content.split('\n')
  const lineCount = lines.length
  const byteCount = Buffer.byteLength(content, 'utf8')

  if (lineCount <= maxLines && byteCount <= maxBytes) {
    return { content, truncated: false }
  }

  ensureTruncateDir()

  const truncatedLines = lines.slice(0, maxLines)
  let truncatedContent = truncatedLines.join('\n')

  if (Buffer.byteLength(truncatedContent, 'utf8') > maxBytes) {
    let bytes = 0
    let charCount = 0
    for (const char of truncatedContent) {
      bytes += Buffer.byteLength(char, 'utf8')
      if (bytes > maxBytes) break
      charCount++
    }
    truncatedContent = truncatedContent.slice(0, charCount) + '\n... (truncated to byte limit)'
  } else {
    const remainingLines = lineCount - maxLines
    truncatedContent += `\n... (${remainingLines} more lines)`
  }

  const outputPath = path.join(TRUNCATE_DIR, `tool_${randomUUID()}.txt`)
  fs.writeFileSync(outputPath, content, 'utf8')

  return {
    content: truncatedContent,
    truncated: true,
    outputPath,
  }
}

export function cleanupTruncateDir(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
  if (!fs.existsSync(TRUNCATE_DIR)) return

  const now = Date.now()
  const files = fs.readdirSync(TRUNCATE_DIR)

  for (const file of files) {
    if (!file.startsWith('tool_')) continue
    const filePath = path.join(TRUNCATE_DIR, file)
    const stat = fs.statSync(filePath)
    if (now - stat.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath)
    }
  }
}
