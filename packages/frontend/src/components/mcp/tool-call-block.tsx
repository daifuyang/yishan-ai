'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import { Cog, Glasses, LayoutList, Shell, Search, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextShimmer } from '@/components/ui/text-shimmer'
import { ToolCard } from './tool-card'
import type { ToolCall, ToolCallGroup } from '@/types'

interface ToolCallBlockProps {
  toolCalls: ToolCall[]
  variant?: 'full' | 'compact'
}

const CONTEXT_GROUP_TOOLS = new Set(['read', 'glob', 'grep', 'list'])

function getToolIcon(name: string) {
  switch (name) {
    case 'read':
      return Glasses
    case 'list':
      return LayoutList
    case 'glob':
    case 'grep':
    case 'search':
      return Search
    case 'bash':
    case 'shell':
      return Shell
    default:
      return Cog
  }
}

function getToolLabel(name: string): string {
  switch (name) {
    case 'read':
      return 'Read'
    case 'list':
      return 'List'
    case 'glob':
      return 'Glob'
    case 'grep':
      return 'Grep'
    case 'bash':
    case 'shell':
      return 'Shell'
    default:
      return name
  }
}

function getToolTitle(name: string): string {
  switch (name) {
    case 'read':
      return 'Read'
    case 'list':
      return 'List'
    case 'glob':
      return 'Glob'
    case 'grep':
      return 'Search'
    case 'bash':
    case 'shell':
      return 'Shell'
    case 'webfetch':
      return 'WebFetch'
    case 'websearch':
      return 'WebSearch'
    case 'task':
      return 'Agent'
    default:
      return name
  }
}

function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function StatusIcon({ status, size = 'sm' }: { status: ToolCall['status']; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'
  switch (status) {
    case 'pending':
      return <Loader2 className={cn(sizeClass, 'animate-spin text-yellow-500')} />
    case 'running':
      return <Loader2 className={cn(sizeClass, 'animate-spin text-blue-500')} />
    case 'completed':
      return <CheckCircle2 className={cn(sizeClass, 'text-green-500')} />
    case 'error':
      return <XCircle className={cn(sizeClass, 'text-red-500')} />
  }
}

function ToolSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const running = toolCalls.filter((tc) => tc.status === 'pending' || tc.status === 'running').length
  const completed = toolCalls.filter((tc) => tc.status === 'completed').length
  const error = toolCalls.filter((tc) => tc.status === 'error').length

  const contextTools = useMemo(() => {
    const reads = toolCalls.filter((t) => t.name === 'read').length
    const searches = toolCalls.filter((t) => ['glob', 'grep', 'search'].includes(t.name)).length
    const lists = toolCalls.filter((t) => t.name === 'list').length
    return { reads, searches, lists }
  }, [toolCalls])

  const shellTools = useMemo(() => {
    return toolCalls.filter((t) => ['bash', 'shell'].includes(t.name))
  }, [toolCalls])

  const otherTools = useMemo(() => {
    const shellNames = new Set(['bash', 'shell'])
    return toolCalls.filter((t) => !shellNames.has(t.name))
  }, [toolCalls])

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-foreground">Tools</span>
      </div>

      {running > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="font-medium">{running}</span>
        </span>
      )}
      {completed > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 text-green-600 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          <span className="font-medium">{completed}</span>
        </span>
      )}
      {error > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-600 text-xs">
          <XCircle className="h-3 w-3" />
          <span className="font-medium">{error}</span>
        </span>
      )}

      {contextTools.reads > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Glasses className="h-3 w-3" />
          <span>{contextTools.reads} read{contextTools.reads !== 1 ? 's' : ''}</span>
        </span>
      )}
      {contextTools.searches > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Search className="h-3 w-3" />
          <span>{contextTools.searches} search{contextTools.searches !== 1 ? 'es' : ''}</span>
        </span>
      )}
      {contextTools.lists > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <LayoutList className="h-3 w-3" />
          <span>{contextTools.lists} list{contextTools.lists !== 1 ? 's' : ''}</span>
        </span>
      )}
      {shellTools.length > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Shell className="h-3 w-3" />
          <span>{shellTools.length} shell{shellTools.length !== 1 ? 's' : ''}</span>
        </span>
      )}
      {otherTools.length > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Cog className="h-3 w-3" />
          <span>{otherTools.length} other{otherTools.length !== 1 ? 's' : ''}</span>
        </span>
      )}
    </div>
  )
}

function ShellSubmessage({ text, animate }: { text: string; animate?: boolean }) {
  const valueRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!animate) return
    requestAnimationFrame(() => {
      if (valueRef.current) {
        valueRef.current.style.opacity = '1'
        valueRef.current.style.filter = 'blur(0px)'
      }
    })
  }, [animate])

  return (
    <span className="tool-shell-submessage">
      <span className="tool-shell-submessage-width">
        <span className="tool-shell-submessage-text">
          <span
            ref={valueRef}
            className="tool-shell-submessage-value"
            style={animate ? { opacity: 0, filter: 'blur(2px)' } : { opacity: 1, filter: 'blur(0px)' }}
          >
            {text}
          </span>
        </span>
      </span>
    </span>
  )
}

function BashTool({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const pending = toolCall.status === 'pending' || toolCall.status === 'running'

  const command = toolCall.input.command as string | undefined
  const description = toolCall.input.description as string | undefined
  const output = typeof toolCall.output === 'string' ? toolCall.output : formatJson(toolCall.output)

  // Keep subtitle semantic: prefer model-provided intent description,
  // never leak raw command into subtitle.
  const displayText = description || '执行命令'
  const text = `\$ ${command ?? ''}${output ? '\n' + output : ''}`

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <div className="tool-card" data-status={toolCall.status}>
      <div className="tool-card-trigger" onClick={() => !pending && setExpanded(!expanded)}>
        <div className="tool-card-trigger-content">
          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text="Shell"
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && displayText && (
                  <ShellSubmessage text={displayText} animate={pending} />
                )}
              </div>
            </div>
          </div>
        </div>

        {!pending && (
          <motion.span
            className="tool-card-arrow"
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <div className="tool-bash-output">
              <div className="tool-bash-copy">
                <button
                  onClick={handleCopy}
                  className="tool-copy-btn"
                  aria-label={copied ? 'Copied' : 'Copy'}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="tool-bash-scroll">
                <pre className="tool-bash-pre"><code>{text}</code></pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ReadTool({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = Glasses
  const pending = toolCall.status === 'pending' || toolCall.status === 'running'

  const filePath = toolCall.input.filePath as string | undefined
  const fileName = filePath?.split('/').pop() ?? filePath

  return (
    <div className="tool-card" data-status={toolCall.status}>
      <div className="tool-card-trigger" onClick={() => !pending && setExpanded(!expanded)}>
        <div className="tool-card-trigger-content">
          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text="Read"
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && fileName && (
                  <span className="tool-card-subtitle">{fileName}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!pending && (
          <motion.span
            className="tool-card-arrow"
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {expanded && toolCall.output !== undefined && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <pre className="tool-output-code"><code>{formatJson(toolCall.output)}</code></pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ListTool({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = LayoutList
  const pending = toolCall.status === 'pending' || toolCall.status === 'running'

  const path = toolCall.input.path as string | undefined
  const dir = path?.split('/').filter(Boolean).slice(0, -1).join('/') || '/'
  const output = typeof toolCall.output === 'string' ? toolCall.output : formatJson(toolCall.output)

  return (
    <div className="tool-card" data-status={toolCall.status}>
      <div className="tool-card-trigger" onClick={() => !pending && setExpanded(!expanded)}>
        <div className="tool-card-trigger-content">
          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text="List"
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && path && (
                  <span className="tool-card-subtitle">{dir || '/'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!pending && (
          <motion.span
            className="tool-card-arrow"
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <pre className="tool-output-code"><code>{output}</code></pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GlobTool({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = Search
  const pending = toolCall.status === 'pending' || toolCall.status === 'running'

  const path = toolCall.input.path as string | undefined
  const pattern = toolCall.input.pattern as string | undefined
  const dir = path?.split('/').filter(Boolean).slice(0, -1).join('/') || '/'
  const output = typeof toolCall.output === 'string' ? toolCall.output : formatJson(toolCall.output)

  return (
    <div className="tool-card" data-status={toolCall.status}>
      <div className="tool-card-trigger" onClick={() => !pending && setExpanded(!expanded)}>
        <div className="tool-card-trigger-content">
          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text="Glob"
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && (
                  <span className="tool-card-subtitle">
                    {dir || '/'}{pattern ? ` - ${pattern}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!pending && (
          <motion.span
            className="tool-card-arrow"
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <pre className="tool-output-code"><code>{output}</code></pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GrepTool({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = Search
  const pending = toolCall.status === 'pending' || toolCall.status === 'running'

  const path = toolCall.input.path as string | undefined
  const pattern = toolCall.input.pattern as string | undefined
  const dir = path?.split('/').filter(Boolean).slice(0, -1).join('/') || '/'
  const output = typeof toolCall.output === 'string' ? toolCall.output : formatJson(toolCall.output)

  return (
    <div className="tool-card" data-status={toolCall.status}>
      <div className="tool-card-trigger" onClick={() => !pending && setExpanded(!expanded)}>
        <div className="tool-card-trigger-content">
          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text="Search"
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && (
                  <span className="tool-card-subtitle">
                    {dir || '/'}{pattern ? ` - ${pattern}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!pending && (
          <motion.span
            className="tool-card-arrow"
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <pre className="tool-output-code"><code>{output}</code></pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GenericToolItem({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const Icon = getToolIcon(toolCall.name)
  const label = getToolTitle(toolCall.name)
  const pending = toolCall.status === 'pending' || toolCall.status === 'running'

  const description = toolCall.input.description as string | undefined
  const output = typeof toolCall.output === 'string' ? toolCall.output : formatJson(toolCall.output)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(formatJson(toolCall.input))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [toolCall.input])

  return (
    <div className="tool-card" data-status={toolCall.status}>
      <div className="tool-card-trigger" onClick={() => !pending && setExpanded(!expanded)}>
        <div className="tool-card-trigger-content">
          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text={label}
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && description && (
                  <span className="tool-card-subtitle">{description}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!pending && (
          <div className="tool-card-actions">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCopy()
              }}
              className="tool-copy-btn"
              aria-label="Copy input"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            <motion.span
              className="tool-card-arrow"
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <ChevronRight className="h-4 w-4" />
            </motion.span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            {output && <pre className="tool-output-code"><code>{output}</code></pre>}
            {toolCall.error && (
              <pre className="tool-error-code"><code>{toolCall.error}</code></pre>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ToolItem({ toolCall }: { toolCall: ToolCall }) {
  switch (toolCall.name) {
    case 'bash':
    case 'shell':
      return <BashTool toolCall={toolCall} />
    case 'read':
      return <ReadTool toolCall={toolCall} />
    case 'list':
      return <ListTool toolCall={toolCall} />
    case 'glob':
      return <GlobTool toolCall={toolCall} />
    case 'grep':
      return <GrepTool toolCall={toolCall} />
    default:
      return <GenericToolItem toolCall={toolCall} />
  }
}

export function ToolCallBlock({ toolCalls, variant = 'full' }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const runningCount = toolCalls.filter((tc) => tc.status === 'pending' || tc.status === 'running').length

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-3 p-2 bg-muted/20 rounded-lg border">
        <ToolSummary toolCalls={toolCalls} />
      </div>
    )
  }

  return (
    <div className="tool-block">
      <div
        className="tool-block-header"
        onClick={() => setExpanded(!expanded)}
      >
        <ToolSummary toolCalls={toolCalls} />
        <div className="tool-block-header-actions">
          {runningCount > 0 && (
            <span className="text-xs text-blue-500 animate-pulse">
              {runningCount} running...
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {expanded ? 'Hide' : 'Details'}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-block-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <div className="tool-block-content-inner">
              {toolCalls.map((toolCall) => (
                <ToolItem key={toolCall.id} toolCall={toolCall} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function groupToolCalls(toolCalls: ToolCall[]): ToolCallGroup[] {
  const groups: ToolCallGroup[] = []
  let currentContextGroup: ToolCall[] = []

  for (const tool of toolCalls) {
    if (CONTEXT_GROUP_TOOLS.has(tool.name)) {
      currentContextGroup.push(tool)
    } else {
      if (currentContextGroup.length > 0) {
        groups.push({ type: 'context', tools: currentContextGroup })
        currentContextGroup = []
      }
      groups.push({ type: 'tool', tools: [tool] })
    }
  }

  if (currentContextGroup.length > 0) {
    groups.push({ type: 'context', tools: currentContextGroup })
  }

  return groups
}

function contextToolSummary(parts: ToolCall[]) {
  const read = parts.filter((part) => part.name === 'read').length
  const search = parts.filter((part) => ['glob', 'grep', 'search'].includes(part.name)).length
  const list = parts.filter((part) => part.name === 'list').length
  return { read, search, list }
}

export function ContextToolGroup({ toolCalls, defaultExpanded = false }: { toolCalls: ToolCall[]; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const summary = contextToolSummary(toolCalls)
  const runningCount = toolCalls.filter((t) => t.status === 'pending' || t.status === 'running').length
  const hasActiveTools = toolCalls.some(t => t.status === 'pending' || t.status === 'running')

  const summaryParts: string[] = []
  if (summary.read > 0) summaryParts.push(`${summary.read} 次读取`)
  if (summary.search > 0) summaryParts.push(`${summary.search} 次搜索`)
  if (summary.list > 0) summaryParts.push(`${summary.list} 个列表`)

  return (
    <div className="tool-group">
      <div
        className="tool-group-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {hasActiveTools ? '正在探索' : '已探索'}
          </span>
          {runningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="font-medium">{runningCount}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {summaryParts.join(', ')}
          </span>
        </div>
        <div className="tool-group-header-actions">
          <span className="text-xs text-muted-foreground">
            {expanded ? '收起' : '详情'}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-group-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <div className="tool-group-content-inner">
              {toolCalls.map((tool) => (
                <ToolItem key={tool.id} toolCall={tool} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function IndependentToolGroup({ toolCalls, defaultExpanded = false }: { toolCalls: ToolCall[]; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const runningCount = toolCalls.filter((t) => t.status === 'pending' || t.status === 'running').length

  return (
    <div className="tool-group">
      <div
        className="tool-group-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Cog className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tools</span>
          </div>
          {runningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="font-medium">{runningCount}</span>
            </span>
          )}
        </div>
        <div className="tool-group-header-actions">
          <span className="text-xs text-muted-foreground">
            {expanded ? 'Hide' : 'Details'}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-group-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <div className="tool-group-content-inner">
              {toolCalls.map((tool) => (
                <ToolItem key={tool.id} toolCall={tool} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ToolCallGroup({
  groups,
  defaultExpanded = false,
}: {
  groups: ToolCallGroup[]
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const allTools = groups.flatMap((g) => g.tools)
  const runningCount = allTools.filter((t) => t.status === 'pending' || t.status === 'running').length

  return (
    <div className="tool-group">
      <div
        className="tool-group-header"
        onClick={() => setExpanded(!expanded)}
      >
        <ToolSummary toolCalls={allTools} />
        <div className="tool-group-header-actions">
          {runningCount > 0 && (
            <span className="text-xs text-blue-500 animate-pulse">
              {runningCount} running...
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {expanded ? 'Hide' : 'Details'}
          </span>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="tool-group-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            <div className="tool-group-content-inner">
              {groups.map((group, groupIdx) =>
                group.tools.map((tool) => (
                  <ToolItem key={tool.id} toolCall={tool} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ToolCallBadgeList({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (toolCalls.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {toolCalls.map((tc) => (
        <span
          key={tc.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
        >
          <StatusIcon status={tc.status} />
          <span className="font-mono">{tc.name}</span>
        </span>
      ))}
    </div>
  )
}
