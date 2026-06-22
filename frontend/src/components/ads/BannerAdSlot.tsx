import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { AD_MODE, AD_KEYS, isActive } from '../../lib/adProviders';

/**
 * Inline banner ad slot.
 *
 * "page-level" networks (Adsterra Social Bar, PopAds, ClickAdu, HilltopAds)
 * are loaded globally via useAdNetworks() in AdsPage.
 *
 * This component handles INLINE banner slots:
 *  - adsterra-direct  → Adsterra Direct Link iframe (no site verification needed)
 *  - monetag-native   → Monetag native/banner zone
 *  - placeholder      → Animated demo banner (dev mode)
 */

type SlotType = 'adsterra-direct' | 'monetag-native' | 'monetag-inpage' | 'placeholder';

interface Props {
  slot: SlotType;
  className?: string;
  label?: string;
}

// ── Adsterra Direct Link (iframe) ──────────────────────────────────────────
// This format works WITHOUT site verification.
// Adsterra direct link earns CPM for every iframe load.
function AdsterraDirect() {
  const key = AD_KEYS.adsterra;
  if (!key) return null;
  return (
    <iframe
      src={`//www.profitablegateway.com/${key}/direct.html`}
      style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden' }}
      scrolling="no"
      title="Advertisement"
    />
  );
}

// ── Monetag Native Banner (script) ─────────────────────────────────────────
function MonatagNative({ zoneId }: { zoneId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !zoneId) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `//cdn.monetag.com/natb.js?id=${zoneId}`;
    ref.current.appendChild(s);
    return () => { try { ref.current?.removeChild(s); } catch {} };
  }, [zoneId]);
  return <div ref={ref} className="w-full h-full" />;
}

function MonatagInPage({ zoneId }: { zoneId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !zoneId) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `//glimmer.monetag.com/inpage.js?zone=${zoneId}`;
    ref.current.appendChild(s);
    return () => { try { ref.current?.removeChild(s); } catch {} };
  }, [zoneId]);
  return <div ref={ref} className="w-full h-full" />;
}

// ── Placeholder (dev / fallback) ───────────────────────────────────────────
function PlaceholderBanner() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const items = [
    { text: 'Shop Amazing Deals', sub: 'Up to 70% off', bg: 'bg-indigo-500' },
    { text: 'Play & Win Prizes',  sub: 'Free to join',  bg: 'bg-emerald-500' },
    { text: 'Earn More Today',    sub: 'Top earners made ₹500+', bg: 'bg-amber-500' },
    { text: 'Download Our App',   sub: 'Get bonus 100 pts',      bg: 'bg-rose-500' },
    { text: 'Finance App',        sub: 'Invest from ₹10',        bg: 'bg-violet-500' },
  ];
  const item = items[tick % items.length];

  return (
    <div className={`w-full h-full ${item.bg} flex items-center justify-center rounded-lg transition-colors duration-700`}>
      <div className="text-center text-white px-3">
        <p className="font-semibold text-sm leading-tight">{item.text}</p>
        <p className="text-white/70 text-xs mt-0.5">{item.sub}</p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function BannerAdSlot({ slot, className }: Props) {
  let content: React.ReactNode;

  if (!AD_MODE) {
    content = <PlaceholderBanner />;
  } else if (slot === 'adsterra-direct' && isActive('adsterra')) {
    content = <AdsterraDirect />;
  } else if (slot === 'monetag-native' && isActive('monetag2')) {
    content = <MonatagNative zoneId={AD_KEYS.monetag2} />;
  } else if (slot === 'monetag-inpage' && isActive('monetag1')) {
    content = <MonatagInPage zoneId={AD_KEYS.monetag1} />;
  } else {
    content = <PlaceholderBanner />;
  }

  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-gray-100 min-h-[90px]', className)}>
      <span className="absolute top-1 left-1 z-10 bg-black/30 text-white text-[10px] px-1 py-px rounded pointer-events-none">
        Ad
      </span>
      <div className="w-full h-full">{content}</div>
    </div>
  );
}
