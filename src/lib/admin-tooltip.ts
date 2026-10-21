/** Fixed body-level tooltips — never clipped by sidebar overflow / backdrop-filter. */

const EDGE = 8;
const TIP_ID = 'cms-admin-tooltip-layer';
const GAP = 10;

let hideTimer: number | null = null;
let activeEl: HTMLElement | null = null;
let cleanupListeners: (() => void) | null = null;

function tipEl(): HTMLDivElement {
  let el = document.getElementById(TIP_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = TIP_ID;
    el.className = 'cms-admin-tooltip-layer';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

type Placement = 'top' | 'bottom' | 'right' | 'left';

function preferredPositions(
  placement: Placement,
  anchor: DOMRect,
  size: { w: number; h: number },
): Array<{ left: number; top: number; place: Placement }> {
  const midY = anchor.top + anchor.height / 2 - size.h / 2;
  const midX = anchor.left + anchor.width / 2 - size.w / 2;
  const right = { left: anchor.right + GAP, top: midY, place: 'right' as const };
  const left = { left: anchor.left - GAP - size.w, top: midY, place: 'left' as const };
  const top = { left: midX, top: anchor.top - GAP - size.h, place: 'top' as const };
  const bottom = { left: midX, top: anchor.bottom + GAP, place: 'bottom' as const };

  if (placement === 'right') return [right, left, bottom, top];
  if (placement === 'left') return [left, right, bottom, top];
  if (placement === 'top') return [top, bottom, right, left];
  return [bottom, top, right, left];
}

function fits(left: number, top: number, size: { w: number; h: number }, vw: number, vh: number) {
  return left >= EDGE && top >= EDGE && left + size.w <= vw - EDGE && top + size.h <= vh - EDGE;
}

function clampPos(
  placement: Placement,
  anchor: DOMRect,
  size: { w: number; h: number },
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (const cand of preferredPositions(placement, anchor, size)) {
    if (fits(cand.left, cand.top, size, vw, vh)) {
      return { left: Math.round(cand.left), top: Math.round(cand.top) };
    }
  }

  // Last resort: clamp preferred placement into the viewport.
  const primary = preferredPositions(placement, anchor, size)[0];
  return {
    left: Math.round(Math.min(vw - EDGE - size.w, Math.max(EDGE, primary.left))),
    top: Math.round(Math.min(vh - EDGE - size.h, Math.max(EDGE, primary.top))),
  };
}

function readSize(tip: HTMLDivElement): { w: number; h: number } {
  const rect = tip.getBoundingClientRect();
  return {
    w: Math.ceil(rect.width) || tip.offsetWidth,
    h: Math.ceil(rect.height) || tip.offsetHeight,
  };
}

/** Position (and show) the shared tooltip for an element with data-tooltip. */
export function placeAdminTooltip(el: HTMLElement) {
  const text = el.getAttribute('data-tooltip') || '';
  if (!text) {
    hideAdminTooltip();
    return;
  }

  if (hideTimer != null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  cleanupListeners?.();
  cleanupListeners = null;
  activeEl = el;

  const placement = (el.getAttribute('data-tooltip-placement') || 'bottom') as Placement;
  const tip = tipEl();
  tip.textContent = text;
  tip.hidden = false;
  tip.style.left = '0px';
  tip.style.top = '0px';
  tip.dataset.show = '1';

  const position = () => {
    if (activeEl !== el || !el.isConnected) {
      hideAdminTooltip();
      return;
    }
    const size = readSize(tip);
    const pos = clampPos(placement, el.getBoundingClientRect(), size);
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;
  };

  position();
  requestAnimationFrame(position);

  const onScrollOrResize = () => position();
  const onLeave = () => scheduleHide(el);

  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('blur', onLeave);
  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);

  cleanupListeners = () => {
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('blur', onLeave);
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
  };
}

function scheduleHide(el: HTMLElement) {
  if (activeEl !== el) return;
  hideTimer = window.setTimeout(() => {
    if (activeEl === el) hideAdminTooltip();
  }, 40);
}

export function hideAdminTooltip() {
  if (hideTimer != null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  cleanupListeners?.();
  cleanupListeners = null;
  activeEl = null;
  const tip = document.getElementById(TIP_ID) as HTMLDivElement | null;
  if (!tip) return;
  tip.dataset.show = '0';
  tip.hidden = true;
  tip.textContent = '';
  tip.style.left = '';
  tip.style.top = '';
}
