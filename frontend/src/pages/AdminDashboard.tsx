import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, DollarSign, PlayCircle, AlertTriangle,
  TrendingUp, Clock, CheckCircle, XCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { api } from '../utils/api';
import { StatCard } from '../components/common/Card';
import { Button } from '../components/common/Button';

interface AdminStats {
  users: {
    total: string; active: string; pending: string;
    new_today: string; new_this_week: string;
  };
  revenue: {
    total_views: string; today_views: string;
    total_revenue: string; today_revenue: string;
  };
  ads: { total: string; active: string };
  withdrawals: { pending_count: string; pending_amount: string };
  fraud: { flagged_users: string; open_events: string };
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/admin/stats').then((r) => r.data.data!),
    refetchInterval: 30000,
  });

  const { data: chartData } = useQuery({
    queryKey: ['admin-revenue-chart'],
    queryFn: () =>
      api.get<{ data: { chart: { date: string; views: string; revenue: string }[] } }>(
        '/admin/revenue/chart?days=30'
      ).then((r) => r.data.data!.chart),
  });

  const formattedChart = chartData?.map((d) => ({
    date: d.date.slice(5), // MM-DD
    views: parseInt(d.views),
    revenue: parseFloat(d.revenue).toFixed(2),
  })) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={parseInt(stats?.users.total || '0').toLocaleString()}
          subtitle={`+${stats?.users.new_today || 0} today`}
          icon={<Users size={22} />}
          color="primary"
        />
        <StatCard
          label="Today Revenue"
          value={`$${parseFloat(stats?.revenue.today_revenue || '0').toFixed(2)}`}
          subtitle={`$${parseFloat(stats?.revenue.total_revenue || '0').toFixed(2)} total`}
          icon={<DollarSign size={22} />}
          color="green"
        />
        <StatCard
          label="Pending Withdrawals"
          value={stats?.withdrawals.pending_count || '0'}
          subtitle={`₹${parseFloat(stats?.withdrawals.pending_amount || '0').toFixed(2)} total`}
          icon={<Clock size={22} />}
          color="yellow"
        />
        <StatCard
          label="Fraud Alerts"
          value={parseInt(stats?.fraud.open_events || '0')}
          subtitle={`${stats?.fraud.flagged_users || 0} flagged users`}
          icon={<AlertTriangle size={22} />}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Daily Ad Views (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={formattedChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="views" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend (30 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={formattedChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Pending Withdrawals', count: stats?.withdrawals.pending_count, link: '/admin/withdrawals', color: 'yellow', icon: Clock },
          { title: 'Fraud Events', count: stats?.fraud.open_events, link: '/admin/fraud', color: 'red', icon: AlertTriangle },
          { title: 'Active Ads', count: stats?.ads.active, link: '/admin/ads', color: 'primary', icon: PlayCircle },
          { title: 'New Users (Week)', count: stats?.users.new_this_week, link: '/admin/users', color: 'green', icon: Users },
        ].map((item) => (
          <Link key={item.link} to={item.link}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{item.count || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">{item.title}</p>
                </div>
                <item.icon size={24} className="text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
