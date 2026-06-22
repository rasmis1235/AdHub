import { useEffect, useRef } from 'react';
import { AD_MODE, AD_KEYS, isActive } from '../lib/adProviders';

/**
 * Loads ALL active ad network scripts once per page session.
 * Call this once inside the AdsPage (or Layout if you want ads everywhere).
 *
 * Networks loaded here are "page-level" — they serve passively in the background:
 *  - Adsterra Social Bar  → floating widget, earns per impression
 *  - PopAds               → pop-under on first click, earns per pop view
 *  - ClickAdu             → push notification pop, earns per view
 *  - HilltopAds           → in-page push / native, earns per impression
 *  - Monetag              → in-page push / native, earns per impression
 */
export function useAdNetworks() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !AD_MODE) return;
    loaded.current = true;

    // ── Adsterra Social Bar ──────────────────────────────────────────────
    // Social Bar floats on page, earns CPM passively.
    // Script: //www.highperformanceformat.com/{KEY}/invoke.js
    if (isActive('adsterra')) {
      injectScript(
        `//www.highperformanceformat.com/${AD_KEYS.adsterra}/invoke.js`,
        { 'data-cfasync': 'false' }
      );
    }

    // ── PopAds ──────────────────────────────────────────────────────────
    // Loads a pop-under on first user click. Earns per pop view (pure CPM).
    // Signup: popads.net → "Become a Publisher" → get numeric publisher ID
    // Very easy, no site verification required.
    if (isActive('popads')) {
      injectScript('//cdn.popads.net/pop.js', {}, () => {
        const w = window as unknown as Record<string, unknown>;
        if (typeof w['popad'] === 'function') {
          (w['popad'] as (id: string) => void)(AD_KEYS.popads);
        }
      });
    }

    // ── ClickAdu ────────────────────────────────────────────────────────
    // Push/pop network, CPM based. Easy signup at clickadu.com
    if (isActive('clickadu')) {
      injectScript(
        `//brtmr.com/${AD_KEYS.clickadu}/invoke.js`,
        { 'data-cfasync': 'false' }
      );
    }

    // ── HilltopAds In-Page Push ──────────────────────────────────────────
    // High India CPM. Signup at hilltopads.com → Publisher zone (In-Page Push)
    if (isActive('hilltopads')) {
      injectScript(
        `//jsc.mgrid.com/${AD_KEYS.hilltopads}/invoke.js`,
        { 'data-cfasync': 'false' }
      );
    }

    // ── Monetag In-Page Push ─────────────────────────────────────────────
    if (isActive('monetag1')) {
      injectScript(
        `//glimmer.monetag.com/inpage.js?zone=${AD_KEYS.monetag1}`,
        {}
      );
    }
    if (isActive('monetag2')) {
      injectScript(
        `//cdn.monetag.com/natb.js?id=${AD_KEYS.monetag2}`,
        {}
      );
    }
  }, []);
}

function injectScript(
  src: string,
  attrs: Record<string, string> = {},
  onLoad?: () => void
): HTMLScriptElement {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  if (onLoad) s.onload = onLoad;
  document.head.appendChild(s);
  return s;
}
