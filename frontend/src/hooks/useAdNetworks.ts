import { useEffect, useRef } from 'react';
import { AD_MODE, AD_SCRIPTS } from '../lib/adProviders';

/**
 * Loads all active Adsterra page-level scripts once per session.
 * Social Bar and Popunder run passively in the background while the user watches ads.
 */
export function useAdNetworks() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !AD_MODE) return;
    loaded.current = true;

    // Adsterra Social Bar — floating widget, earns CPM passively
    if (AD_SCRIPTS.socialBar) {
      injectScript(AD_SCRIPTS.socialBar, { 'data-cfasync': 'false' });
    }

    // Adsterra Popunder — earns per page visit (fires on first user click)
    if (AD_SCRIPTS.popunder) {
      injectScript(AD_SCRIPTS.popunder, { 'data-cfasync': 'false' });
    }

    // PopAds
    if (AD_SCRIPTS.popads) {
      injectScript('//cdn.popads.net/pop.js', {}, () => {
        const w = window as unknown as Record<string, unknown>;
        if (typeof w['popad'] === 'function') {
          (w['popad'] as (id: string) => void)(AD_SCRIPTS.popads);
        }
      });
    }

    // HilltopAds
    if (AD_SCRIPTS.hilltopads) {
      injectScript(`//jsc.mgrid.com/${AD_SCRIPTS.hilltopads}/invoke.js`, { 'data-cfasync': 'false' });
    }

    // ClickAdu
    if (AD_SCRIPTS.clickadu) {
      injectScript(`//brtmr.com/${AD_SCRIPTS.clickadu}/invoke.js`, { 'data-cfasync': 'false' });
    }

    // Monetag
    if (AD_SCRIPTS.monetag1) {
      injectScript(`//glimmer.monetag.com/inpage.js?zone=${AD_SCRIPTS.monetag1}`, {});
    }
    if (AD_SCRIPTS.monetag2) {
      injectScript(`//cdn.monetag.com/natb.js?id=${AD_SCRIPTS.monetag2}`, {});
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
