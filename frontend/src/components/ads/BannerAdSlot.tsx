import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

// ── Adsterra banner zones ─────────────────────────────────────────────────────
const ZONES = {
  '300x250': { key: 'bf9103d9f0170bdc145996416eb1f958', w: 300,  h: 250 },
  '728x90':  { key: 'fa8d16b34b8d434d7a3cded1ecf395d4', w: 728,  h: 90  },
  '160x600': { key: '53934e1e68e9892e4ec4e8ff2082df78', w: 160,  h: 600 },
  '468x60':  { key: '4b373646635af27e4f6fcdad5b677805', w: 468,  h: 60  },
  '320x50':  { key: '9e6b416f530beb25ce6aa0de64396caa', w: 320,  h: 50  },
  '160x300': { key: 'cdb214880b799434293a8afecf7a24a5', w: 160,  h: 300 },
} as const;

// Native banner (different format — needs a container div with specific ID)
const NATIVE_SRC = 'https://pl29850294.effectivecpmnetwork.com/850cbd1bc655041eba6e743bd48a48ef/invoke.js';
const NATIVE_ID  = 'container-850cbd1bc655041eba6e743bd48a48ef';

type ZoneKey = keyof typeof ZONES;
export type SlotType = ZoneKey | 'native';

interface Props {
  slot: SlotType;
  className?: string;
  refreshIntervalSec?: number;
}

// Adsterra iframe banner — sets atOptions then loads invoke.js
function IframeBanner({ zoneKey, refreshKey }: { zoneKey: ZoneKey; refreshKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const zone = ZONES[zoneKey];

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';

    // atOptions must be set on window BEFORE invoke.js loads
    (window as unknown as Record<string, unknown>).atOptions = {
      key: zone.key,
      format: 'iframe',
      height: zone.h,
      width: zone.w,
      params: {},
    };

    const s = document.createElement('script');
    s.src = `https://www.highperformanceformat.com/${zone.key}/invoke.js`;
    s.async = true;
    ref.current.appendChild(s);

    return () => { ref.current && (ref.current.innerHTML = ''); };
  }, [refreshKey]);

  return <div ref={ref} className="w-full h-full flex items-center justify-center overflow-hidden" />;
}

// Adsterra native banner — needs container div present before script loads
function NativeBanner({ refreshKey }: { refreshKey: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = `<div id="${NATIVE_ID}"></div>`;

    const s = document.createElement('script');
    s.src = NATIVE_SRC;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    ref.current.appendChild(s);

    return () => { ref.current && (ref.current.innerHTML = ''); };
  }, [refreshKey]);

  return <div ref={ref} className="w-full h-full" />;
}

export function BannerAdSlot({ slot, className, refreshIntervalSec }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto-refresh → unmount + remount ad script → fresh CPM impression
  useEffect(() => {
    if (!refreshIntervalSec) return;
    const t = setInterval(() => setRefreshKey((k) => k + 1), refreshIntervalSec * 1000);
    return () => clearInterval(t);
  }, [refreshIntervalSec]);

  const content = slot === 'native'
    ? <NativeBanner refreshKey={refreshKey} />
    : <IframeBanner zoneKey={slot} refreshKey={refreshKey} />;

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50', className)}>
      <span className="absolute top-0.5 left-0.5 z-10 bg-black/30 text-white text-[9px] px-1 py-px rounded pointer-events-none">
        Ad
      </span>
      {content}
    </div>
  );
}
