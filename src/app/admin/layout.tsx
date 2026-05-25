import './admin.css';
import './admin-modern.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      {children}
    </div>
  );
}
