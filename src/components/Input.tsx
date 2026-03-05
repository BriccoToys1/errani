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
          className={`w-full bg-[#111] border border-[rgba(255,255,255,0.08)] px-4 py-3 text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#E8722A] transition-colors ${
            error ? 'border-red-500/60' : ''
          } ${className}`}
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
