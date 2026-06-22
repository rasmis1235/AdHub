import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import { AD_SCRIPTS } from '../../lib/adProviders';

const ADSTERRA_SMARTLINK = 'https://www.effectivecpmnetwork.com/swm99h7e?key=2e97e1250c279cf3e75cc5b1ce1b3544';

type SlotType = 'adsterra-smartlink' | 'adsterra-native' | 'monetag-native' | 'monetag-inpage' | 'placeholder';

interface Props {
  slot: SlotType;
  className?: string;
  label?: string;
}

function AdsterraSmartlink() {
  return (
    <iframe
      src={ADSTERRA_SMARTLINK}
      style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden', display: 'block' }}
      scrolling="no"
      title="Advertisement"
    />
  );
}

// Adsterra Native Banner script (zone 29749795)
function AdsterraNative() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !AD_SCRIPTS.native) return;
    const s = document.createElement('script');
    s.src = AD_SCRIPTS.native;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    ref.current.appendChild(s);
    return () => { try { ref.current?.removeChild(s); } catch {} };
  }, []);
  return <div ref={ref} className="w-full h-full" />;
}

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

function PlaceholderBanner() {
  return (
    <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center rounded-lg">
      <div className="text-center text-white px-3">
        <p className="font-semibold text-sm">Advertisement</p>
        <p className="text-white/70 text-xs mt-0.5">Ad loading...</p>
      </div>
    </div>
  );
}

export function BannerAdSlot({ slot, className }: Props) {
  let content: React.ReactNode;

  if (!AD_MODE) {
    content = <PlaceholderBanner />;
  } else if (slot === 'adsterra-smartlink') {
    content = <AdsterraSmartlink />;
  } else if (slot === 'adsterra-native' && AD_SCRIPTS.native) {
    content = <AdsterraNative />;
  } else if (slot === 'monetag-native' && AD_SCRIPTS.monetag2) {
    content = <MonatagNative zoneId={AD_SCRIPTS.monetag2} />;
  } else if (slot === 'monetag-inpage' && AD_SCRIPTS.monetag1) {
    content = <MonatagInPage zoneId={AD_SCRIPTS.monetag1} />;
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
