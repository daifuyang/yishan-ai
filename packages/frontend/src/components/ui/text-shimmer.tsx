'use client';

import React, { type ReactNode, useEffect, useRef, useState } from 'react';

export interface TextShimmerProps {
  text: string;
  active?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  children?: ReactNode;
}

export function TextShimmer({
  text,
  active = true,
  className = '',
  as: Component = 'span',
}: TextShimmerProps) {
  const [isActive, setIsActive] = useState(active);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      setIsActive(true);
      return;
    }

    timerRef.current = setTimeout(() => {
      setIsActive(false);
    }, 220);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [active]);

  return (
    <Component
      className={`text-shimmer ${className}`}
      data-component="text-shimmer"
      data-active={isActive ? 'true' : 'false'}
    >
      <span className="text-shimmer-char">
        <span className="text-shimmer-char-base" aria-hidden="true">
          {text}
        </span>
        <span
          className="text-shimmer-char-shimmer"
          data-run={isActive ? 'true' : 'false'}
          aria-hidden="true"
        >
          {text}
        </span>
      </span>
    </Component>
  );
}
