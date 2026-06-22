import React, { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

// Each banner loads in its own iframe (isolated window) so atOptions never conflicts.
const ZONES = {
  '300x250': { key: 'bf9103d9f0170bdc145996416eb1f958', w: 300, h: 250 },
  '728x90':  { key: 'fa8d16b34b8d434d7a3cded1ecf395d4', w: 728, h: 90  },
  '160x600': { key: '53934e1e68e9892e4ec4e8ff2082df78', w: 160, h: 600 },
  '468x60':  { key: '4b373646635af27e4f6fcdad5b677805', w: 468, h: 60  },
  '320x50':  { key: '9e6b416f530beb25ce6aa0de64396caa', w: 320, h: 50  },
  '160x300': { key: 'cdb214880b799434293a8afecf7a24a5', w: 160, h: 300 },
} as const;

export type SlotType = keyof typeof ZONES | 'native';

interface Props {
  slot: SlotType;
  className?: string;
  refreshIntervalSec?: number;
}

function adHtml(key: string, w: number, h: number) {
  return `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;overflow:hidden}</style></head><body>
<script>atOptions={'key':'${key}','format':'iframe','height':${h},'width':${w},'params':{}}</script>
<script src="https://www.highperformanceformat.com/${key}/invoke.js"></script>
</body></html>`;
}

function nativeHtml() {
  return `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}</style></head><body>
<div id="container-850cbd1bc655041eba6e743bd48a48ef"></div>
<script async data-cfasync="false" src="https://pl29850294.effectivecpmnetwork.com/850cbd1bc655041eba6e743bd48a48ef/invoke.js"></script>
</body></html>`;
}

export function BannerAdSlot({ slot, className, refreshIntervalSec }: Props) {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!refreshIntervalSec) return;
    const t = setInterval(() => setKey((k) => k + 1), refreshIntervalSec * 1000);
    return () => clearInterval(t);
  }, [refreshIntervalSec]);

  const zone = slot !== 'native' ? ZONES[slot] : null;
  const html = zone ? adHtml(zone.key, zone.w, zone.h) : nativeHtml();

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center', className)}>
      <span className="absolute top-0.5 left-0.5 z-10 bg-black/30 text-white text-[9px] px-1 py-px rounded pointer-events-none">Ad</span>
      <iframe
        key={key}
        srcDoc={html}
        scrolling="no"
        frameBorder="0"
        style={{ width: '100%', height: '100%', display: 'block' }}
        title="ad"
      />
    </div>
  );
}
