'use client';

import React from 'react';
import { EmptyState } from './empty-state';

interface EmptyStateLayoutProps {
  className?: string;
}

export function EmptyStateLayout({ className }: EmptyStateLayoutProps) {
  return (
    <div
      className={
        className ||
        'flex flex-col items-center justify-center h-full px-4 py-8'
      }
    >
      <EmptyState />
    </div>
  );
}
