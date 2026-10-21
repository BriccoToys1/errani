import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm' | 'xs';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon rendered before the label (icon + text order). */
  icon?: IconName;
  /** Icon rendered after the label (e.g. dropdown arrow). */
  iconRight?: IconName;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'sm', icon, iconRight, className = '', children, type = 'button', ...rest },
  ref,
) {
  const classes = [
    'cms-btn',
    size === 'sm' ? 'cms-btn-sm' : size === 'xs' ? 'cms-btn-xs' : '',
    variant !== 'default' ? `cms-btn-${variant}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'xs' ? 13 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={14} className="cms-btn-trailing" />}
    </button>
  );
});
