'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size' | 'onSubmit'> {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  size?: 'md' | 'sm';
  width?: number | string;
}

/** The single admin search input: magnifier icon + "Поиск" placeholder, pill shape. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, onSubmit, placeholder = 'Поиск', size = 'sm', width, className = '', style, ...rest },
  ref,
) {
  return (
    <label
      className={`cms-search cms-search-${size} ${className}`.trim()}
      style={{ width, ...style }}
    >
      <Icon name="search" size={14} className="cms-search-icon" />
      <input
        ref={ref}
        type="search"
        className="cms-search-input"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) onSubmit(value);
          if (e.key === 'Escape' && value) onChange('');
        }}
        {...rest}
      />
    </label>
  );
});
