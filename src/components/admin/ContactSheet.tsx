'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { IconButton } from './IconButton';

export interface ContactTarget {
  type: 'phone' | 'email';
  value: string;
}

/**
 * Small popup shown when an email/phone icon is clicked:
 * value + [copy] [write (email only)] [close]. Opens the mail dialog on "write".
 */
export function ContactSheet({
  contact,
  onClose,
  onCopied,
}: {
  contact: ContactTarget | null;
  onClose: () => void;
  onCopied?: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  if (!contact) return null;

  const copy = () => {
    navigator.clipboard
      .writeText(contact.value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
        onCopied?.();
      })
      .catch(() => undefined);
  };

  return (
    <div className="cms-contact-sheet-backdrop" onClick={onClose}>
      <div className="cms-contact-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--cms-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            {contact.type === 'phone' ? 'Телефон' : 'Email'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cms-text)', wordBreak: 'break-all' }}>
            {contact.value}
          </div>
        </div>
        <IconButton icon={copied ? 'check' : 'copy'} label="Скопировать" shape="square" onClick={copy} />
        {contact.type === 'email' && (
          <IconButton
            icon="mail"
            label="Написать"
            shape="square"
            onClick={() => {
              router.push(`/admin/email?thread=${encodeURIComponent(contact.value.trim().toLowerCase())}`);
              onClose();
            }}
          />
        )}
        <IconButton icon="close" label="Закрыть" shape="square" onClick={onClose} />
      </div>
    </div>
  );
}

/** State + node helper: `const { open, node } = useContactSheet();` → render `{node}`. */
export function useContactSheet(): { open: (c: ContactTarget) => void; node: ReactNode } {
  const [contact, setContact] = useState<ContactTarget | null>(null);
  const close = useCallback(() => setContact(null), []);
  return {
    open: setContact,
    node: <ContactSheet contact={contact} onClose={close} />,
  };
}
