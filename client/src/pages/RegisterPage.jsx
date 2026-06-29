/* eslint-disable i18next/no-literal-string */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle, CheckCircle, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from '../api/axios.js';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    setServerError('');
    setSuccessMessage('');
    try {
      const response = await axios.post('/api/v1/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password
      });
      setSuccessMessage(response.data?.message || 'Registration successful! Your account is pending administrator approval.');
      toast.success('Registration request submitted!');
      reset();
    } catch (err) {
      setServerError(err.response?.data?.error || err.message || 'Registration failed');
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #faf7f2 0%, #f0e8dc 50%, #e8ddd0 100%)' }}>

      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #e8a87c 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-24 w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #c8956c 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl p-8 shadow-xl border"
          style={{ background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(20px)', borderColor: 'rgba(200,149,108,0.20)' }}>

          {/* Logo mark */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-md"
              style={{ background: 'linear-gradient(135deg, #c8956c 0%, #e8a87c 100%)' }}>
              <Layers size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: '#2d2520' }}>LeadsBase</h1>
            <p className="text-xs uppercase tracking-widest mt-1" style={{ color: '#b5a898' }}>Create an Account</p>
          </div>

          {/* Error */}
          {serverError && (
            <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl mb-4 border"
              style={{ background: 'rgba(192,57,43,0.07)', borderColor: 'rgba(192,57,43,0.25)', color: '#c0392b' }}>
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl mb-4 border"
              style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.25)', color: '#10b981' }}>
              <CheckCircle size={14} className="flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a6a5a' }}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                {...register('name')}
                disabled={isSubmitting}
                style={{ borderColor: errors.name ? 'rgba(192,57,43,0.5)' : undefined }}
              />
              {errors.name && <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>{errors.name.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a6a5a' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                disabled={isSubmitting}
                style={{ borderColor: errors.email ? 'rgba(192,57,43,0.5)' : undefined }}
              />
              {errors.email && <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>{errors.email.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a6a5a' }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isSubmitting}
                style={{ borderColor: errors.password ? 'rgba(192,57,43,0.5)' : undefined }}
              />
              {errors.password && <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>{errors.password.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a6a5a' }}>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                disabled={isSubmitting}
                style={{ borderColor: errors.confirmPassword ? 'rgba(192,57,43,0.5)' : undefined }}
              />
              {errors.confirmPassword && <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>{errors.confirmPassword.message}</span>}
            </div>

            <button type="submit" className="w-full flex items-center justify-center gap-2 font-bold py-2.5 px-4 rounded-xl text-white shadow-md transition-all mt-4"
              style={{
                background: 'linear-gradient(135deg, #c8956c 0%, #e8a87c 100%)',
                opacity: isSubmitting ? 0.7 : 1
              }}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Register</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs font-medium" style={{ color: '#7a6a5a' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold transition-all" style={{ color: 'var(--accent)' }}>
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
