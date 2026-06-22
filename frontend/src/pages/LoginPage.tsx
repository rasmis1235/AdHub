import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

const schema = z.object({
  email: z.string().min(1, 'Email or username required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: string })?.from || '/dashboard';

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const [lastEmail, setLastEmail] = useState('');
  const [showResend, setShowResend] = useState(false);

  const onSubmit = async (data: FormData) => {
    try {
      const result = await login(data.email, data.password);
      if (result.meta.requestStatus === 'fulfilled') {
        toast.success('Welcome back!');
        navigate(from, { replace: true });
      } else {
        const msg = (result.payload as string) || 'Login failed';
        toast.error(msg);
        if (msg.includes('verify your email')) {
          setLastEmail(data.email);
          setShowResend(true);
        }
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const resendVerification = async () => {
    try {
      const { api } = await import('../utils/api');
      await api.post('/auth/resend-verification', { email: lastEmail });
      toast.success('Verification email sent! Check your inbox and spam folder.');
      setShowResend(false);
    } catch {
      toast.error('Could not resend. Try again later.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-accent-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur">
            <TrendingUp className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">AdHub</h1>
          <p className="text-white/70 mt-1">Watch ads. Earn real money.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email or Username"
              type="text"
              placeholder="you@example.com"
              autoComplete="email"
              leftIcon={<Mail size={16} />}
              error={errors.email?.message}
              {...register('email', {
                onChange: (e) => setValue('email', e.target.value, { shouldValidate: false }),
              })}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              leftIcon={<Lock size={16} />}
              error={errors.password?.message}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register('password', {
                onChange: (e) => setValue('password', e.target.value, { shouldValidate: false }),
              })}
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Sign In
            </Button>

            {showResend && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                Email not verified.{' '}
                <button
                  type="button"
                  onClick={resendVerification}
                  className="font-semibold underline hover:text-yellow-900"
                >
                  Resend verification email
                </button>
              </div>
            )}
          </form>

          <div className="mt-4 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <a
            href="/api/auth/google"
            className="mt-4 flex items-center justify-center gap-3 w-full border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>

          <p className="text-center text-sm text-gray-600 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Create one free
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          {[
            { emoji: '💰', text: 'Earn Points' },
            { emoji: '📺', text: 'Watch Ads' },
            { emoji: '🎁', text: 'Get Rewards' },
          ].map((item) => (
            <div key={item.text} className="text-white/80">
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-xs">{item.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
