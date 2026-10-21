'use client';

import { forwardRef, useCallback, type ButtonHTMLAttributes, type FocusEvent, type MouseEvent } from 'react';
import { Icon, type IconName } from './Icon';
import { CountBadge } from './CountBadge';
import { hideAdminTooltip, placeAdminTooltip } from '@/lib/admin-tooltip';

export type IconButtonShape = 'plain' | 'square' | 'circle';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Accessible label; also shown as tooltip. */
  label: string;
  /** plain = bare icon (page headers), square/circle = icon inside a container. */
  shape?: IconButtonShape;
  size?: 'md' | 'sm';
  tone?: 'default' | 'danger' | 'accent';
  active?: boolean;
  badge?: number;
  tooltipPlacement?: 'top' | 'bottom' | 'right';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    shape = 'square',
    size = 'sm',
    tone = 'default',
    active = false,
    badge,
    tooltipPlacement = 'bottom',
    className = '',
    type = 'button',
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const classes = [
    'cms-iconbtn',
    `cms-iconbtn-${shape}`,
    `cms-iconbtn-${size}`,
    tone !== 'default' ? `cms-iconbtn-${tone}` : '',
    active ? 'active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const positionTip = useCallback((el: HTMLElement) => {
    el.setAttribute('data-tooltip-placement', tooltipPlacement);
    placeAdminTooltip(el);
  }, [tooltipPlacement]);

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      positionTip(e.currentTarget);
      onMouseEnter?.(e);
    },
    [onMouseEnter, positionTip],
  );

  const handleMouseLeave = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      hideAdminTooltip();
      onMouseLeave?.(e);
    },
    [onMouseLeave],
  );

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLButtonElement>) => {
      positionTip(e.currentTarget);
      onFocus?.(e);
    },
    [onFocus, positionTip],
  );

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLButtonElement>) => {
      hideAdminTooltip();
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-placement={tooltipPlacement}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      <Icon name={icon} size={size === 'md' ? 18 : 15} />
      {typeof badge === 'number' && badge > 0 && <CountBadge count={badge} className="cms-iconbtn-badge" />}
    </button>
  );
});
