import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, TrendingUp, Flame, Target } from 'lucide-react';
import { formatPoints, pointsToInr } from '../../utils/cn';

interface Props {
  sessionPoints: number;
  totalAvailable: number;
  adsWatchedToday: number;
  dailyGoal: number;
  streak: number;
  lastEarned: number | null; // triggers animation
}

export function EarningsTracker({
  sessionPoints,
  totalAvailable,
  adsWatchedToday,
  dailyGoal,
  streak,
  lastEarned,
}: Props) {
  const [displayPoints, setDisplayPoints] = useState(sessionPoints);
  const [plusPoints, setPlusPoints] = useState<{ id: number; value: number }[]>([]);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(0);

  // Animate counter when points change
  useEffect(() => {
    if (counterRef.current) clearInterval(counterRef.current);
    const start = displayPoints;
    const end = sessionPoints;
    if (start === end) return;
    const steps = 20;
    const increment = (end - start) / steps;
    let step = 0;
    counterRef.current = setInterval(() => {
      step++;
      setDisplayPoints(Math.round(start + increment * step));
      if (step >= steps) {
        clearInterval(counterRef.current!);
        setDisplayPoints(end);
      }
    }, 30);
    return () => { if (counterRef.current) clearInterval(counterRef.current); };
  }, [sessionPoints]);

  // Show floating +N when user earns
  useEffect(() => {
    if (!lastEarned || lastEarned <= 0) return;
    const id = ++idRef.current;
    setPlusPoints((prev) => [...prev, { id, value: lastEarned }]);
    setTimeout(() => setPlusPoints((prev) => prev.filter((p) => p.id !== id)), 1500);
  }, [lastEarned]);

  const progressPct = Math.min(100, (adsWatchedToday / dailyGoal) * 100);
  const bonusUnlocked = adsWatchedToday >= dailyGoal;

  return (
    <div className="space-y-3">
      {/* Main earnings card */}
      <div className="bg-gradient-to-br from-primary-600 to-purple-700 rounded-2xl p-5 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-6 -translate-x-6" />

        <div className="relative">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wider">This Session</p>
          <div className="flex items-end gap-2 mt-1 relative">
            <span className="text-4xl font-black tabular-nums">{formatPoints(displayPoints)}</span>
            <span className="text-white/60 text-sm mb-1">pts</span>

            {/* Floating +N animations */}
            <AnimatePresence>
              {plusPoints.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ opacity: 1, y: 0, x: 0 }}
                  animate={{ opacity: 0, y: -40 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  className="absolute left-0 top-0 text-yellow-300 font-black text-xl pointer-events-none"
                >
                  +{p.value}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <p className="text-white/80 text-sm font-medium">
            = {pointsToInr(displayPoints)}
          </p>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-white/60 text-xs">Total Balance</p>
            <p className="font-bold text-sm">{formatPoints(totalAvailable)} pts</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <p className="text-white/60 text-xs">= Cash Value</p>
            <p className="font-bold text-sm">{pointsToInr(totalAvailable)}</p>
          </div>
        </div>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="text-2xl">🔥</div>
          <div>
            <p className="font-bold text-orange-700 text-sm">{streak}-Day Streak!</p>
            <p className="text-orange-500 text-xs">Keep watching daily to earn bonus</p>
          </div>
        </div>
      )}

      {/* Daily goal */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Target size={15} className="text-primary-500" />
            Daily Goal
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            bonusUnlocked
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {bonusUnlocked ? '🎉 Completed!' : `${adsWatchedToday}/${dailyGoal} ads`}
          </span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${bonusUnlocked ? 'bg-green-500' : 'bg-primary-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {!bonusUnlocked && (
          <p className="text-xs text-gray-400 mt-1.5">
            {dailyGoal - adsWatchedToday} more ads → earn <span className="text-primary-600 font-bold">+50 bonus pts</span>
          </p>
        )}
      </div>

      {/* Rate info */}
      <div className="bg-gray-50 rounded-xl p-3 text-center">
        <p className="text-xs text-gray-400">Your share per ad view</p>
        <p className="text-sm font-bold text-gray-700 mt-0.5">
          5–15 pts = ₹0.05–₹0.15
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Paid weekly via UPI/Bank</p>
      </div>
    </div>
  );
}
