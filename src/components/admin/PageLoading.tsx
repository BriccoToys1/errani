'use client';

import { PulsatingDots } from '@/components/loading-ui/pulsating-dots';

/** Full-viewport centred page loader for admin routes. */
export function PageLoading({ label = 'Загрузка' }: { label?: string }) {
  return (
    <div className="cms-loading" role="status" aria-live="polite" aria-label={label}>
      <PulsatingDots className="cms-page-loading-dots" />
    </div>
  );
}
