import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import './admin.css';
import './admin-modern.css';
import './admin-ui.css';
import type { Metadata, Viewport } from 'next';
import { AdminShell } from './AdminShell';

export const metadata: Metadata = {
  title: 'ERRANI Admin',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#08090c',
  colorScheme: 'dark',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
