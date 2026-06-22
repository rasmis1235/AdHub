import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User, AtSign, TrendingUp, Gift } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { registerThunk } from '../store/slices/authSlice';
import { AppDispatch } from '../store';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

const schema = z.object({
  full_name: z.string().min(2, 'At least 2 characters'),
  email: z.string().email('Invalid email'),
  username: z.string()
    .min(3, 'At least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscore'),
  password: z.string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'One uppercase letter')
    .regex(/[0-9]/, 'One number'),
  confirmPassword: z.string(),
  referral_code: z.string().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { referral_code: refCode },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const result = await dispatch(registerThunk({
        email: data.email,
        username: data.username,
        full_name: data.full_name,
        password: data.password,
        referral_code: data.referral_code || undefined,
      }));

      if (result.meta.requestStatus === 'fulfilled') {
        toast.success('Account created! Please check your email to verify.');
        navigate('/login');
      } else {
        toast.error((result.payload as string) || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-accent-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-3 backdrop-blur">
            <TrendingUp className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Join AdHub</h1>
          <p className="text-white/70 text-sm mt-1">Start earning from day one</p>
        </div>

        {refCode && (
          <div className="bg-yellow-400/20 border border-yellow-400/40 rounded-xl p-3 mb-4 text-center">
            <div className="flex items-center justify-center gap-2 text-yellow-200 text-sm font-medium">
              <Gift size={16} />
              Referral bonus activated! You'll get 50 extra points.
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Rahul Kumar"
              leftIcon={<User size={16} />}
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail size={16} />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Username"
              type="text"
              placeholder="rahul_kumar"
              leftIcon={<AtSign size={16} />}
              error={errors.username?.message}
              hint="Only letters, numbers, underscore"
              {...register('username')}
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              leftIcon={<Lock size={16} />}
              error={errors.password?.message}
              rightElement={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register('password')}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat password"
              leftIcon={<Lock size={16} />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Input
              label="Referral Code (optional)"
              type="text"
              placeholder="AHXXXXXX"
              leftIcon={<Gift size={16} />}
              {...register('referral_code')}
            />

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300 text-primary-600"
                {...register('acceptTerms')}
              />
              <span className="text-sm text-gray-600">
                I agree to the{' '}
                <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>
              </span>
            </label>
            {errors.acceptTerms && (
              <p className="text-xs text-red-500 -mt-2">{errors.acceptTerms.message}</p>
            )}

            <Button type="submit" fullWidth isLoading={isLoading} size="lg">
              Create Free Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
