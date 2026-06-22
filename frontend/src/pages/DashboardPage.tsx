import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Coins, TrendingUp, Users, PlayCircle,
  Copy, CheckCircle, ArrowRight, Wallet, Zap, Target, Flame
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { StatCard } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { formatPoints, pointsToInr, timeAgo } from '../utils/cn';
import { DashboardData } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const DAILY_GOAL = 20;

export default function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<{ data: DashboardData }>('/user/dashboard').then((r) => r.data.data!),
    refetchInterval: 30000,
  });

  const { data: todayStats } = useQuery({
    queryKey: ['user-stats-today'],
    queryFn: () =>
      api
        .get<{ data: { ads_watched_today: number; points_today: number } }>('/user/stats')
        .then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const copyReferralLink = () => {
    navigator.clipboard.writeText(data?.referralUrl || '');
    toast.success('Referral link copied!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const stats = data?.earnings;
  const adsToday = todayStats?.ads_watched_today ?? 0;
  const pointsToday = todayStats?.points_today ?? 0;
  const streak = user?.streak_days ?? 0;
  const dailyProgress = Math.min(100, (adsToday / DAILY_GOAL) * 100);
  const bonusDone = adsToday >= DAILY_GOAL;

  const chartData = data?.recentTransactions?.slice(0, 7).reverse().map((t, i) => ({
    day: `${i + 1}`,
    points: Math.abs(t.points),
  })) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-2xl p-6 text-white"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {user?.full_name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-white/80 mt-1">
              Lifetime earnings:{' '}
              <span className="font-bold text-yellow-300">
                {formatPoints(stats?.lifetime_earnings || 0)} pts
              </span>{' '}
              ({pointsToInr(stats?.lifetime_earnings || 0)})
            </p>
          </div>
          <Link to="/ads">
            <Button variant="secondary" className="bg-white text-primary-700 hover:bg-white/90">
              <Zap size={16} />
              Start Earning Now
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Today's summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Daily progress */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 sm:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-primary-500" />
              <span className="font-semibold text-gray-800 text-sm">Today's Goal</span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              bonusDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {bonusDone ? '🎉 Completed!' : `${adsToday} / ${DAILY_GOAL} ads`}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full ${bonusDone ? 'bg-green-500' : 'bg-primary-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${dailyProgress}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              Earned today:{' '}
              <span className="font-bold text-primary-600">{formatPoints(pointsToday)} pts</span>
              {' '}({pointsToInr(pointsToday)})
            </span>
            {!bonusDone && (
              <span>
                {DAILY_GOAL - adsToday} more → <strong className="text-primary-600">+50 bonus</strong>
              </span>
            )}
          </div>
        </div>

        {/* Streak */}
        <div className={`rounded-xl border p-5 flex items-center gap-4 ${
          streak > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
        }`}>
          <div className="text-4xl">{streak > 0 ? '🔥' : '💤'}</div>
          <div>
            <p className="font-black text-2xl text-gray-900">{streak}</p>
            <p className="text-sm font-semibold text-gray-600">
              {streak > 0 ? 'Day Streak!' : 'No streak yet'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {streak > 0 ? 'Keep watching daily' : 'Watch ads today to start'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Available Points"
          value={formatPoints(stats?.available_points || 0)}
          subtitle={pointsToInr(stats?.available_points || 0)}
          icon={<Coins size={22} />}
          color="primary"
        />
        <StatCard
          label="Lifetime Earned"
          value={formatPoints(stats?.lifetime_earnings || 0)}
          icon={<TrendingUp size={22} />}
          color="green"
        />
        <StatCard
          label="Total Withdrawn"
          value={pointsToInr(stats?.total_withdrawn || 0)}
          icon={<Wallet size={22} />}
          color="purple"
        />
        <StatCard
          label="Active Referrals"
          value={data?.referralStats?.active_referrals || 0}
          subtitle={`${data?.referralStats?.total_referrals || 0} total`}
          icon={<Users size={22} />}
          color="yellow"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Earnings Activity</h3>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <div className="text-center">
                <PlayCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Watch ads to see your earnings chart</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [`${v} pts`, 'Points']}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="points"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorPoints)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Referral Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Your Referral Link</h3>
          <p className="text-sm text-gray-500 mb-4">
            Earn <span className="font-semibold text-primary-600">100 points</span>{' '}
            for each friend who joins and verifies.
          </p>

          <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700 break-all mb-3">
            {data?.referralUrl}
          </div>

          <Button onClick={copyReferralLink} fullWidth variant="outline" leftIcon={<Copy size={14} />}>
            Copy Link
          </Button>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Referrals</span>
              <span className="font-medium">{data?.referralStats?.total_referrals || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active</span>
              <span className="font-medium text-green-600 flex items-center gap-1">
                <CheckCircle size={12} />
                {data?.referralStats?.active_referrals || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bonus Earned</span>
              <span className="font-medium text-primary-600">
                {formatPoints(data?.referralStats?.total_bonus || 0)} pts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Ad Views</h3>
            <Link to="/ads/history" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {data?.recentAds?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <PlayCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No ads watched yet</p>
              <Link to="/ads">
                <Button size="sm" className="mt-3">Watch your first ad</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.recentAds?.map((view) => (
                <div key={view.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                      {view.ad_title}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(view.created_at)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    +{view.points_earned} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Transaction History</h3>
            <Link to="/transactions" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {data?.recentTransactions?.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {data?.recentTransactions?.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {tx.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(tx.created_at)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <p className="font-bold text-lg">Ready to earn more?</p>
          <p className="text-white/60 text-sm mt-0.5">
            Multiple ads play at once — watch video + earn from banners simultaneously
          </p>
        </div>
        <Link to="/ads">
          <Button className="bg-primary-500 hover:bg-primary-400 text-white border-0">
            <Zap size={16} />
            Go to Ads Page
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
