'use client'

import { useState, type ReactNode, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TextShimmer } from '@/components/ui/text-shimmer'

export interface ToolCardProps {
  icon?: ReactNode
  title: string
  subtitle?: string
  status?: 'pending' | 'running' | 'completed' | 'error'
  defaultOpen?: boolean
  hideDetails?: boolean
  children?: ReactNode
  onSubtitleClick?: () => void
  className?: string
  action?: ReactNode
}

export function ToolCard({
  icon,
  title,
  subtitle,
  status = 'completed',
  defaultOpen = false,
  hideDetails = false,
  children,
  className,
  action,
}: ToolCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const pending = status === 'pending' || status === 'running'

  return (
    <div className={cn('tool-card', className)} data-status={status}>
      <div
        className="tool-card-trigger"
        onClick={() => !pending && !hideDetails && setOpen(!open)}
      >
        <div className="tool-card-trigger-content">
          <div className="tool-card-indicator">
            {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!pending && icon}
          </div>

          <div className="tool-card-info">
            <div className="tool-card-info-structured">
              <div className="tool-card-info-main">
                <TextShimmer
                  text={title}
                  active={pending}
                  className="tool-card-title"
                />
                {!pending && subtitle && (
                  <span className="tool-card-subtitle">
                    {subtitle}
                  </span>
                )}
              </div>
              {!pending && action && (
                <span className="tool-card-action">{action}</span>
              )}
            </div>
          </div>
        </div>

        {!hideDetails && !pending && children && (
          <motion.span
            className="tool-card-arrow"
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="tool-card-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', visualDuration: 0.35, bounce: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}