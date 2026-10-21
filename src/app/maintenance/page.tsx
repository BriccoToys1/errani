import type { Metadata } from 'next';
import { MAINTENANCE_MESSAGE, MAINTENANCE_TITLE } from '@/lib/maintenance';

export const metadata: Metadata = {
  title: MAINTENANCE_TITLE,
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="maintenance-page" aria-live="polite">
      <div className="maintenance-card">
        <p className="maintenance-brand">errani</p>
        <h1 className="maintenance-title">{MAINTENANCE_TITLE}</h1>
        <p className="maintenance-text">{MAINTENANCE_MESSAGE}</p>
        <p className="maintenance-hint">Попробуйте зайти чуть позже.</p>
      </div>
    </main>
  );
}
