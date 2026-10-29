// Runs in the browser. Ignore content intentionally clipped by horizontal scrollers
// (admin tables/nav), but still flag scrollers whose own frame leaves the viewport.
export function auditLayout() {
  const width = document.documentElement.clientWidth;
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden') return false;
    return true;
  };
  const outside = [...document.querySelectorAll('body *')].filter((el) => {
    if (!visible(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.left >= -1 && rect.right <= width + 1) return false;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const p = parent.getBoundingClientRect();
      if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)
        && p.left >= -1 && p.right <= width + 1) return false;
    }
    return true;
  }).map((el) => ({ tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').slice(0, 80), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) }));
  const smallTargets = [...document.querySelectorAll('[role="button"], [role="tab"], [role="checkbox"], button')]
    .filter(visible).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < 44 || r.height < 44;
    }).map((el) => ({ label: (el.getAttribute('aria-label') || el.textContent || '').slice(0, 80), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) }));
  return { width, outside, smallTargets };
}
