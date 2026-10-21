'use client';

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs tracking-wider uppercase text-[#999]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-3 text-sm focus:outline-none focus:border-[#f58bdc] transition-colors ${
            error ? 'border-red-500/60' : ''
          } ${className}`}
          style={{ background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border-2)', borderRadius: '0.5rem' }}
          {...props}
        />
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
