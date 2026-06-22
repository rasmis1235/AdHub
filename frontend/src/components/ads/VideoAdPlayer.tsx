import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Pause, Volume2, VolumeX, CheckCircle2,
  ExternalLink, SkipForward, Loader2
} from 'lucide-react';
import { Ad } from '../../types';
import { cn } from '../../utils/cn';
import { Button } from '../common/Button';
// Adsterra Smartlink — rasmis1235.tech zone 29749797
const ADSTERRA_SMARTLINK = 'https://www.effectivecpmnetwork.com/swm99h7e?key=2e97e1250c279cf3e75cc5b1ce1b3544';

interface Props {
  ad: Ad | null;
  queueIndex: number;
  queueTotal: number;
  isLoading: boolean;
  canClaim: boolean;
  progress: number;          // 0-100
  timeRemaining: number;     // seconds
  onClaim: (clicked: boolean) => void;
  onSkip: () => void;
  onVisitSite: () => void;
  isClaiming: boolean;
}

export function VideoAdPlayer({
  ad,
  queueIndex,
  queueTotal,
  isLoading,
  canClaim,
  progress,
  timeRemaining,
  onClaim,
  onSkip,
  onVisitSite,
  isClaiming,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (videoRef.current && ad?.media_url) {
      videoRef.current.src = ad.media_url;
      videoRef.current.muted = muted;
      videoRef.current.play().catch(() => {});
    }
  }, [ad?.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const toggleMute = () => setMuted((m) => !m);
  const togglePause = () => {
    if (!videoRef.current) return;
    if (paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
    setPaused((p) => !p);
  };

  if (!ad) {
    return (
      <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="text-white animate-spin" size={40} />
        ) : (
          <div className="text-center text-white/60">
            <Play size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Select an ad from the queue to start</p>
          </div>
        )}
      </div>
    );
  }

  const minWatchPct = ad.min_watch_percent ?? 80;
  const pointsToEarn = ad.points_per_completion || ad.points_per_view;

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
      {/* Queue indicator */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">NOW PLAYING</span>
          <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {queueIndex + 1} / {queueTotal}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-sm">
          <span>+{pointsToEarn}</span>
          <span className="text-yellow-400/70 text-xs">pts</span>
        </div>
      </div>

      {/* Video area */}
      <div className="relative aspect-video bg-black group">
        {ad.media_url && ad.ad_type === 'video' ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            muted={muted}
            onEnded={() => { if (canClaim) onClaim(false); }}
          />
        ) : (
          /* Adsterra Smartlink iframe */
          <iframe
            key={ad.id}
            src={ADSTERRA_SMARTLINK}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            scrolling="no"
            title="Advertisement"
            allow="autoplay"
          />
        )}

        {/* Top progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-700">
          <motion.div
            className={cn(
              'h-full rounded-full',
              canClaim ? 'bg-green-400' : 'bg-primary-500'
            )}
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Skip shield - prevents skipping before min_watch_percent */}
        {!canClaim && (
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }} />
        )}

        {/* Mute/pause controls (overlay) */}
        <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {ad.ad_type === 'video' && (
            <>
              <button
                onClick={togglePause}
                className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button
                onClick={toggleMute}
                className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </>
          )}
        </div>

        {/* Countdown badge (top-right) */}
        {!canClaim && (
          <div className="absolute top-3 right-3 bg-black/60 rounded-lg px-2.5 py-1 text-white text-xs font-mono">
            ⏱ {timeRemaining}s
          </div>
        )}

        {/* Earn badge when ready */}
        {canClaim && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
            onClick={() => onClaim(false)}
          >
            <CheckCircle2 size={14} />
            Claim +{pointsToEarn} pts!
          </motion.div>
        )}
      </div>

      {/* Controls bar */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-white font-semibold text-sm leading-tight truncate">{ad.title}</p>
            {!canClaim && (
              <p className="text-gray-400 text-xs mt-0.5">
                Watch {minWatchPct}% to earn{' '}
                <span className="text-yellow-400 font-bold">+{pointsToEarn} pts</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canClaim && (
              <Button
                size="sm"
                onClick={() => onClaim(false)}
                isLoading={isClaiming}
                leftIcon={<CheckCircle2 size={14} />}
                className="bg-green-500 hover:bg-green-600 text-white border-0 animate-pulse"
              >
                Claim
              </Button>
            )}
            {ad.click_url && canClaim && (
              <Button
                size="sm"
                variant="outline"
                className="text-white border-gray-600 hover:bg-gray-700"
                onClick={onVisitSite}
                leftIcon={<ExternalLink size={14} />}
              >
                +{ad.points_per_click}pts
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-400 hover:text-white hover:bg-gray-700"
              onClick={onSkip}
              leftIcon={<SkipForward size={14} />}
              title={canClaim ? 'Skip to next' : 'Watch more to skip'}
              disabled={!canClaim && progress < 10}
            >
              Skip
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full transition-colors',
              canClaim ? 'bg-green-500' : 'bg-primary-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{Math.round(progress)}% watched</span>
          <span className={canClaim ? 'text-green-400 font-medium' : ''}>
            {canClaim ? '✓ Ready to claim!' : `Need ${minWatchPct}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
