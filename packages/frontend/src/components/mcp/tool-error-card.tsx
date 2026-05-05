'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Copy, Check, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOOL_NAMES: Record<string, string> = {
  read: 'Read',
  list: 'List',
  glob: 'Glob',
  grep: 'Grep',
  task: 'Task',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  bash: 'Shell',
  apply_patch: 'Patch',
  question: 'Question',
}

export interface ToolErrorCardProps {
  tool: string
  error: string
  defaultOpen?: boolean
  subtitle?: string
  className?: string
}

function getToolLabel(tool: string): string {
  return TOOL_NAMES[tool] ?? tool
}

function cleanError(error: string): string {
  return error.replace(/^Error:\s*/, '').trim()
}

function getErrorBody(error: string): string {
  const cleaned = cleanError(error)
  const parts = cleaned.split(': ')
  if (parts.length <= 1) return cleaned
  return parts.slice(1).join(': ').trim() || cleaned
}

function getErrorSubtitle(error: string): string {
  const cleaned = cleanError(error)
  const parts = cleaned.split(': ')
  if (parts.length <= 1) return 'Failed'
  const head = (parts[0] ?? '').trim()
  if (!head) return 'Failed'
  return head[0] ? head[0].toUpperCase() + head.slice(1) : 'Failed'
}

export function ToolErrorCard({
  tool,
  error,
  defaultOpen = false,
  subtitle,
  className,
}: ToolErrorCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = cleanError(error)
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const body = getErrorBody(error)
  const autoSubtitle = subtitle ?? getErrorSubtitle(error)

  return (
    <div className={cn('tool-error-card', className)}>
      <div
        className="tool-error-card-trigger"
        onClick={() => setOpen(!open)}
      >
        <div className="tool-error-card-trigger-content">
          <span className="tool-error-card-icon">
            <Ban className="h-4 w-4 text-destructive" />
          </span>
          <div className="tool-error-card-info">
            <div className="tool-error-card-info-structured">
              <div className="tool-error-card-info-main">
                <span className="tool-error-card-title">{getToolLabel(tool)}</span>
                <span className="tool-error-card-subtitle">{autoSubtitle}</span>
              </div>
            </div>
          </div>
        </div>
        <motion.span
          className="tool-error-card-arrow"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="tool-error-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <div className="tool-error-card-copy">
              <button
                onClick={handleCopy}
                className="tool-error-card-copy-btn"
                aria-label={copied ? 'Copied' : 'Copy error'}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {body && <p className="tool-error-card-body">{body}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}