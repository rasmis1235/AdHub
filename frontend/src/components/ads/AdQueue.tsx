import React from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, ChevronRight, Zap } from 'lucide-react';
import { Ad } from '../../types';
import { cn } from '../../utils/cn';

interface Props {
  ads: Ad[];
  currentAdId: string | null;
  onSelectAd: (ad: Ad) => void;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
}

const AD_TYPE_COLORS: Record<string, string> = {
  video: 'bg-blue-500',
  banner: 'bg-purple-500',
  interstitial: 'bg-orange-500',
  native: 'bg-green-500',
  rewarded: 'bg-yellow-500',
};

export function AdQueue({ ads, currentAdId, onSelectAd, autoPlay, onToggleAutoPlay }: Props) {
  const totalPotential = ads.reduce((sum, a) => sum + (a.points_per_completion || a.points_per_view), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Up Next</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {ads.length} ads · up to +{totalPotential} pts
          </p>
        </div>
        {/* Autoplay toggle */}
        <button
          onClick={onToggleAutoPlay}
          className={cn(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors text-xs',
            autoPlay ? 'bg-primary-500' : 'bg-gray-300'
          )}
          title="Auto-play next ad"
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              autoPlay ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {/* Queue list */}
      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
        {ads.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Zap size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No more ads in queue</p>
            <p className="text-xs mt-0.5">Check back in a few minutes</p>
          </div>
        ) : (
          ads.map((ad, idx) => {
            const isActive = ad.id === currentAdId;
            const points = ad.points_per_completion || ad.points_per_view;

            return (
              <motion.button
                key={ad.id}
                onClick={() => onSelectAd(ad)}
                whileHover={{ backgroundColor: '#f9fafb' }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  isActive ? 'bg-primary-50' : 'bg-white hover:bg-gray-50'
                )}
              >
                {/* Thumbnail / type indicator */}
                <div className="relative flex-shrink-0 w-12 h-9 rounded overflow-hidden bg-gray-100">
                  {ad.thumbnail_url ? (
                    <img
                      src={ad.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={cn(
                      'w-full h-full flex items-center justify-center',
                      AD_TYPE_COLORS[ad.ad_type] || 'bg-gray-400'
                    )}>
                      <Play size={12} className="text-white" />
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-primary-500/30 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-xs font-semibold leading-tight truncate',
                    isActive ? 'text-primary-700' : 'text-gray-800'
                  )}>
                    {ad.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ad.duration_seconds && (
                      <span className="text-gray-400 text-xs flex items-center gap-0.5">
                        <Clock size={9} /> {ad.duration_seconds}s
                      </span>
                    )}
                    <span className={cn(
                      'text-xs px-1.5 py-px rounded font-medium',
                      AD_TYPE_COLORS[ad.ad_type] || 'bg-gray-400',
                      'text-white text-opacity-90'
                    )}>
                      {ad.ad_type}
                    </span>
                  </div>
                </div>

                {/* Points */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-black text-primary-600">+{points}</p>
                  <p className="text-xs text-gray-400">pts</p>
                </div>

                {isActive && (
                  <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                    <Play size={8} className="text-white ml-0.5" />
                  </div>
                )}
              </motion.button>
            );
          })
        )}
      </div>

      {/* Autoplay status footer */}
      <div className={cn(
        'px-4 py-2 text-xs text-center',
        autoPlay ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400'
      )}>
        {autoPlay ? '⚡ Auto-play ON — earns more automatically' : 'Auto-play off — tap ads to watch'}
      </div>
    </div>
  );
}
