import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '../../utils/cn';

/**
 * Multi-network banner slot with auto-refresh.
 * Each render = 1 CPM impression. Refresh every N seconds = more CPM.
 *
 * Adsterra banner codes: paste the full <script> src URL per zone below.
 * Get from: Adsterra dashboard → GET CODE → copy src from the script tag.
 */

// ── Adsterra banner zone script URLs (fill in after GET CODE) ────────────────
const ADSTERRA_ZONES: Record<string, string> = {
  '300x250': '', // zone 29749801 — paste src URL here
  '728x90':  '', // zone 29749802 — paste src URL here
  '160x600': '', // zone 29749800 — paste src URL here
  '468x60':  '', // zone 29749799 — paste src URL here
  '320x50':  '', // zone 29749803 — paste src URL here
  '160x300': '', // zone 29749798 — paste src URL here
  'native':  '', // zone 29749795 — paste src URL here
};

// ── Network badge ─────────────────────────────────────────────────────────────
type Network = 'adsterra' | 'monetag' | 'placeholder';

interface Props {
  slot: keyof typeof ADSTERRA_ZONES | 'monetag-native' | 'monetag-inpage';
  className?: string;
  refreshIntervalSec?: number; // auto-refresh to get new impression
}

// Each mount of this component fires one script → one CPM impression.
// Unmount + remount = new impression. We use a key to force this.
function AdScriptSlot({ scriptSrc, network }: { scriptSrc: string; network: Network }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !scriptSrc) return;
    // Clear previous ad
    ref.current.innerHTML = '';
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    ref.current.appendChild(s);
  }, [scriptSrc]);

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="w-full h-full" />
      <span className="absolute top-0.5 right-0.5 bg-black/40 text-white text-[9px] px-1 rounded pointer-events-none uppercase tracking-wide">
        {network}
      </span>
    </div>
  );
}

function MonatagSlot({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !src) return;
    ref.current.innerHTML = '';
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    ref.current.appendChild(s);
  }, [src]);
  return <div ref={ref} className="w-full h-full" />;
}

function PlaceholderBanner({ label }: { label?: string }) {
  return (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-lg border border-dashed border-gray-300">
      <p className="text-gray-400 text-xs">{label ?? 'Ad'}</p>
    </div>
  );
}

export function BannerAdSlot({ slot, className, refreshIntervalSec }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh: unmount+remount the ad script → new CPM impression
  useEffect(() => {
    if (!refreshIntervalSec) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), refreshIntervalSec * 1000);
    return () => clearInterval(t);
  }, [refreshIntervalSec]);

  const monetagZone1 = import.meta.env.VITE_MONETAG_ZONE_1 || '';
  const monetagZone2 = import.meta.env.VITE_MONETAG_ZONE_2 || '';

  let content: React.ReactNode;
  const zoneSrc = ADSTERRA_ZONES[slot as keyof typeof ADSTERRA_ZONES] || '';

  if (zoneSrc) {
    content = <AdScriptSlot key={refreshKey} scriptSrc={zoneSrc} network="adsterra" />;
  } else if (slot === 'monetag-native' && monetagZone2) {
    content = <MonatagSlot key={refreshKey} src={`//cdn.monetag.com/natb.js?id=${monetagZone2}`} />;
  } else if (slot === 'monetag-inpage' && monetagZone1) {
    content = <MonatagSlot key={refreshKey} src={`//glimmer.monetag.com/inpage.js?zone=${monetagZone1}`} />;
  } else {
    content = <PlaceholderBanner label={String(slot)} />;
  }

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-gray-100', className)}>
      {content}
    </div>
  );
}
