import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { RefreshCw, Wifi, WifiOff, TrendingUp, Coins } from 'lucide-react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { api, extractError } from '../utils/api';
import { Ad } from '../types';
import { Button } from '../components/common/Button';
import { useAdNetworks } from '../hooks/useAdNetworks';
import { VideoAdPlayer } from '../components/ads/VideoAdPlayer';
import { AdQueue } from '../components/ads/AdQueue';
import { BannerAdSlot } from '../components/ads/BannerAdSlot';
import { EarningsTracker } from '../components/ads/EarningsTracker';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigate } from 'react-router-dom';

interface AdViewState {
  viewId: string;
  adId: string;
  startedAt: number;
}

interface StatsData {
  adsWatchedToday: number;
  sessionPoints: number;
  totalAvailable: number;
  streak: number;
  dailyGoal: number;
}

const DAILY_GOAL = 20;

export default function AdsPage() {
  const queryClient = useQueryClient();
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();

  // Load all page-level ad network scripts (Adsterra Social Bar, PopAds, etc.)
  useAdNetworks();

  // ---- state ----
  const [fingerprint, setFingerprint] = useState('');
  const [activeAd, setActiveAd] = useState<Ad | null>(null);
  const [viewState, setViewState] = useState<AdViewState | null>(null);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [lastEarned, setLastEarned] = useState<number | null>(null);
  const [adsWatchedToday, setAdsWatchedToday] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Device fingerprint
  useEffect(() => {
    FingerprintJS.load()
      .then((fp) => fp.get())
      .then((r) => setFingerprint(r.visitorId));
  }, []);

  // Load available ads
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['available-ads'],
    queryFn: () => api.get<{ data: { ads: Ad[] } }>('/ads').then((r) => r.data.data!),
    refetchInterval: 90_000,
    staleTime: 30_000,
  });

  // Load user stats (ad view counts etc.)
  const { data: statsData } = useQuery({
    queryKey: ['user-stats-today'],
    queryFn: () =>
      api.get<{ data: { ads_watched_today: number } }>('/user/stats').then((r) => ({
        adsWatchedToday: r.data.data?.ads_watched_today ?? 0,
      })),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (statsData) setAdsWatchedToday(statsData.adsWatchedToday);
  }, [statsData]);

  const ads: Ad[] = data?.ads ?? [];

  // ---- mutations ----
  const startMutation = useMutation({
    mutationFn: (adId: string) =>
      api.post<{ data: { viewId: string } }>(`/ads/${adId}/start`).then((r) => r.data.data!),
  });

  const completeMutation = useMutation({
    mutationFn: (payload: {
      viewId: string;
      watchDuration: number;
      watchPercent: number;
      wasClicked: boolean;
      fingerprint: string;
    }) =>
      api
        .post<{ data: { pointsEarned: number; message: string } }>('/ads/complete', payload)
        .then((r) => r.data.data!),
    onSuccess: (result) => {
      const earned = result.pointsEarned;
      if (earned > 0) {
        setSessionPoints((p) => p + earned);
        setLastEarned(earned);
        setAdsWatchedToday((n) => n + 1);
        toast.success(
          <div className="flex items-center gap-2">
            <span className="text-xl">🎉</span>
            <div>
              <p className="font-bold text-sm">{result.message}</p>
              <p className="text-xs text-green-600">+{earned} points added!</p>
            </div>
          </div>,
          { duration: 3000 }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['available-ads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats-today'] });
    },
    onError: (err) => toast.error(extractError(err)),
  });

  // ---- timer / progress ----
  const startTimer = useCallback((ad: Ad) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = ad.duration_seconds || 30;
    const minPct = ad.min_watch_percent ?? 80;
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = Math.min(100, (elapsed / duration) * 100);
      const remaining = Math.max(0, Math.ceil(duration - elapsed));

      setProgress(pct);
      setTimeRemaining(remaining);

      if (pct >= minPct) {
        setCanClaim(true);
      }

      if (pct >= 100) {
        clearInterval(timerRef.current!);
      }
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // ---- ad lifecycle ----
  const startWatching = useCallback(async (ad: Ad) => {
    if (!user) {
      // Guest can see the ad but can't earn — redirect to login when they try to start
      toast('Login to earn points from this ad!', { icon: '🔒' });
      navigate('/login', { state: { from: '/ads' } });
      return;
    }

    stopTimer();
    setActiveAd(ad);
    setProgress(0);
    setTimeRemaining(ad.duration_seconds || 30);
    setCanClaim(false);

    try {
      const result = await startMutation.mutateAsync(ad.id);
      setViewState({ viewId: result.viewId, adId: ad.id, startedAt: Date.now() });
      startTimer(ad);
    } catch (err) {
      toast.error(extractError(err));
      setActiveAd(null);
      setViewState(null);
    }
  }, [startTimer, stopTimer, startMutation]);

  const completeAd = useCallback(
    (clicked: boolean) => {
      if (!viewState) return;
      stopTimer();

      const watchDuration = Math.floor((Date.now() - viewState.startedAt) / 1000);
      const adDuration = activeAd?.duration_seconds || 30;
      const watchPercent = Math.min(100, Math.round((watchDuration / adDuration) * 100));

      completeMutation.mutate(
        { viewId: viewState.viewId, watchDuration, watchPercent, wasClicked: clicked, fingerprint },
        {
          onSettled: () => {
            setActiveAd(null);
            setViewState(null);
            setProgress(0);
            setCanClaim(false);

            // Auto-play next ad
            if (autoPlay) {
              const nextAd = ads.find(
                (a) => a.id !== viewState.adId && a.id !== activeAd?.id
              );
              if (nextAd) {
                setTimeout(() => startWatching(nextAd), 1200);
              }
            }
          },
        }
      );
    },
    [viewState, activeAd, ads, autoPlay, fingerprint, completeMutation, startWatching, stopTimer]
  );

  const skipAd = useCallback(() => {
    stopTimer();
    // If user skips after meeting min watch, credit them
    if (canClaim && viewState) {
      completeAd(false);
    } else {
      setActiveAd(null);
      setViewState(null);
      setProgress(0);
      setCanClaim(false);
      // Auto-play next
      if (autoPlay && ads.length > 0) {
        const nextAd = ads.find((a) => a.id !== activeAd?.id);
        if (nextAd) setTimeout(() => startWatching(nextAd), 800);
      }
    }
  }, [canClaim, viewState, completeAd, stopTimer, autoPlay, ads, activeAd, startWatching]);

  const visitSite = useCallback(() => {
    if (activeAd?.click_url) {
      window.open(activeAd.click_url, '_blank');
      completeAd(true);
    }
  }, [activeAd, completeAd]);

  // Auto-start first ad when page loads
  useEffect(() => {
    if (ads.length > 0 && !activeAd && autoPlay && !startMutation.isPending) {
      startWatching(ads[0]);
    }
  }, [ads.length > 0]);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  const totalAvailable = user?.available_points ?? 0;
  const streak = user?.streak_days ?? 0;

  const queueAds = ads.filter((a) => a.id !== activeAd?.id);
  const queueIndex = activeAd ? ads.findIndex((a) => a.id === activeAd.id) : -1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Top header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <TrendingUp className="text-primary-500" size={24} />
              Watch & Earn
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Watch ads simultaneously — earn points with every view
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Online indicator */}
            <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <Wifi size={12} />
              <span>Live</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Leaderboard — 728x90, refreshes every 60s */}
        <BannerAdSlot slot="728x90" className="h-[90px] mb-4 hidden sm:block" refreshIntervalSec={60} />

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[160px_1fr_300px_260px] gap-4">

          {/* ─── LEFT SKYSCRAPER (xl only) — 160x600, refreshes every 90s ─── */}
          <div className="hidden xl:flex flex-col gap-3">
            <BannerAdSlot slot="160x600" className="h-[600px]" refreshIntervalSec={90} />
          </div>

          {/* ─── CENTER: Video Player + banners below ─── */}
          <div className="space-y-3 order-2 lg:order-1">
            <VideoAdPlayer
              ad={activeAd}
              queueIndex={Math.max(0, queueIndex)}
              queueTotal={ads.length}
              isLoading={isLoading || startMutation.isPending}
              canClaim={canClaim}
              progress={progress}
              timeRemaining={timeRemaining}
              onClaim={completeAd}
              onSkip={skipAd}
              onVisitSite={visitSite}
              isClaiming={completeMutation.isPending}
            />

            {/* 3 banner slots below player — all load simultaneously = 3 CPM */}
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Coins size={11} /> Passive banners loading below
            </p>
            <div className="grid grid-cols-3 gap-2">
              <BannerAdSlot slot="300x250" className="h-[100px]" refreshIntervalSec={45} />
              <BannerAdSlot slot="468x60"  className="h-[100px]" refreshIntervalSec={45} />
              <BannerAdSlot slot="native"  className="h-[100px]" refreshIntervalSec={45} />
            </div>

            {/* Mobile leaderboard */}
            <BannerAdSlot slot="320x50" className="h-[50px] sm:hidden" refreshIntervalSec={60} />
          </div>

          {/* ─── RIGHT: Ad Queue ─── */}
          <div className="order-3 lg:order-2">
            <AdQueue
              ads={queueAds}
              currentAdId={activeAd?.id ?? null}
              onSelectAd={startWatching}
              autoPlay={autoPlay}
              onToggleAutoPlay={() => setAutoPlay((a) => !a)}
            />
            {/* 300x250 in sidebar, refreshes every 60s */}
            <BannerAdSlot slot="160x300" className="h-[300px] mt-3" refreshIntervalSec={60} />
          </div>

          {/* ─── RIGHT-2: Earnings Tracker ─── */}
          <div className="order-1 lg:order-3">
            <EarningsTracker
              sessionPoints={sessionPoints}
              totalAvailable={totalAvailable}
              adsWatchedToday={adsWatchedToday}
              dailyGoal={DAILY_GOAL}
              streak={streak}
              lastEarned={lastEarned}
            />
          </div>
        </div>

        {/* ─── How it works ─── */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4 text-sm">How you earn</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { emoji: '📺', title: 'Watch Video', desc: 'Watch 80%+ of each video ad', pts: '+5–15 pts' },
              { emoji: '🖱️', title: 'Click Ad', desc: 'Click through for bonus points', pts: '+3–10 pts' },
              { emoji: '🔲', title: 'View Banners', desc: 'Banners load passively', pts: '+1–3 pts' },
              { emoji: '🎯', title: 'Daily Goal', desc: `Watch ${DAILY_GOAL} ads today`, pts: '+50 bonus' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="text-2xl mb-2">{item.emoji}</div>
                <p className="text-sm font-bold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.desc}</p>
                <p className="text-xs font-black text-primary-600 mt-1">{item.pts}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span>💡 Revenue split:</span>
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">Platform 80%</span>
            <span>+</span>
            <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">You 20%</span>
            <span>· 1 pt = ₹0.01 · Min withdrawal ₹50</span>
          </div>
        </div>
      </div>
    </div>
  );
}
