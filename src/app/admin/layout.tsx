import './admin.css';
import './admin-modern.css';
import { Outfit } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={outfit.className} style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
}
