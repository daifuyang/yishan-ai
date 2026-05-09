'use client';

import { useEffect } from 'react';

export function VConsoleProvider() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      import('vconsole').then(({ default: VConsole }) => {
        new VConsole({
          theme: 'dark',
        });
      }).catch((err) => {
        console.warn('[VConsole] Failed to load:', err);
      });
    }
  }, []);

  return null;
}
