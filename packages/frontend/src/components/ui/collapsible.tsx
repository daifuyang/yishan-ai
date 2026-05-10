'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

interface CollapsibleContentProps
  extends React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content> {
  children?: React.ReactNode;
}

const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.Content>,
  CollapsibleContentProps
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content ref={ref} className={cn('overflow-hidden', className)} {...props}>
    {children}
  </CollapsiblePrimitive.Content>
));
CollapsibleContent.displayName = 'CollapsibleContent';

interface CollapsibleArrowProps {
  className?: string;
}

function CollapsibleArrow({ className }: CollapsibleArrowProps) {
  return (
    <span className={cn('collapsible-arrow', className)}>
      <ChevronDown className="h-4 w-4" />
    </span>
  );
}

export { Collapsible, CollapsibleArrow, CollapsibleContent, CollapsibleTrigger };
