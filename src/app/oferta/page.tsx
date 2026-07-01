import type { Metadata } from 'next';
import { OfertaContent } from './OfertaContent';

export const metadata: Metadata = {
  title: 'Публичная оферта / Public Offer — errani',
  description: 'Договор купли-продажи между errani и покупателем / Sales agreement between errani and the buyer.',
  robots: { index: false },
};

export default function OfertaPage() {
  return <OfertaContent />;
}
