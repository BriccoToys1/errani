import type { CSSProperties } from 'react';

/** Semantic admin icon names → Flaticon UIcons (regular rounded). */
export const ADMIN_ICONS = {
  refresh: 'refresh',
  export: 'download',
  go: 'site-alt',
  view: 'eye',
  hide: 'eye-crossed',
  delete: 'trash',
  add: 'add',
  newsletter: 'envelopes',
  reply: 'reply-all',
  forward: 'redo',
  copy: 'copy',
  filter: 'settings-sliders',
  filter2: 'filter',
  sort: 'apps-sort',
  logout: 'exit',
  close: 'cross',
  archive: 'inbox-full',
  file: 'folder',
  user: 'user',
  betaComputer: 'beta-computer',
  analytics: 'dashboard-panel',
  mail: 'envelope',
  orders: 'rectangle-list',
  products: 'tags',
  media: 'images',
  requests: 'comment-info',
  waiting: 'duration-alt',
  customers: 'users-alt',
  reviews: 'feedback-review',
  settings: 'settings',
  phone: 'phone-flip',
  edit: 'pencil',
  receipt: 'document',
  down: 'angle-small-down',
  up: 'angle-small-up',
  left: 'angle-small-left',
  right: 'angle-small-right',
  star: 'star',
  check: 'check',
  save: 'disk',
  search: 'search',
  replace: 'shuffle',
  attach: 'paperclip-vertical',
  bell: 'bell',
  duplicate: 'duplicate',
  block: 'ban',
  link: 'link',
  play: 'play',
  stop: 'stop',
  musicFile: 'music-file',
  video: 'film',
  menu: 'menu-burger',
  send: 'paper-plane',
  picture: 'picture',
  wallpaper: 'desktop-wallpaper',
  info: 'info',
  lock: 'lock',
  unarchive: 'box-open',
  calendarDay: 'calendar-day',
  calendarDays: 'calendar-days',
  calendarWeek: 'calendar-week',
  calendar: 'calendar',
  calendarLines: 'calendar-lines',
  calendarPen: 'calendar-pen',
  chartLine: 'chart-line-up',
  chatArrowGrow: 'chat-arrow-grow',
  browser: 'browser',
  list: 'list',
} as const;

export type IconName = keyof typeof ADMIN_ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  return (
    <i
      aria-hidden="true"
      className={`fi fi-rr-${ADMIN_ICONS[name]} cms-icon ${className}`.trim()}
      style={{
        fontSize: size,
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
