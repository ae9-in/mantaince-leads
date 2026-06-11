/* eslint-disable i18next/no-literal-string */
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../api/axios.js';
import { KeyRound, AlertCircle, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      await axios.post('/api/v1/auth/reset-password', {
        token,
        newPassword: data.password
      });
      toast.success('Password updated successfully!');
      navigate('/login');
    } catch (err) {
      setServerError(err.response?.data?.error || 'Password reset failed. Token might be invalid or expired.');
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
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-md"
              style={{ background: 'linear-gradient(135deg, #c8956c 0%, #e8a87c 100%)' }}>
              <Layers size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-center" style={{ color: '#2d2520' }}>New Password</h1>
            <p className="text-xs uppercase tracking-widest mt-1 text-center" style={{ color: '#b5a898' }}>Define new credentials</p>
          </div>

          {serverError && (
            <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl mb-5 border"
              style={{ background: 'rgba(192,57,43,0.07)', borderColor: 'rgba(192,57,43,0.25)', color: '#c0392b' }}>
              <AlertCircle size={14} />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a6a5a' }}>New Password</label>
              <input
                type="password"
                className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                placeholder="••••••••"
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password && (
                <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>{errors.password.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7a6a5a' }}>Confirm New Password</label>
              <input
                type="password"
                className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                placeholder="••••••••"
                {...register('confirmPassword')}
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <span className="text-xs font-semibold" style={{ color: '#c0392b' }}>{errors.confirmPassword.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 bg-[--accent] text-white font-black uppercase py-2.5 rounded-lg hover:bg-[--accent-hover] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #c8956c 0%, #e8a87c 100%)', boxShadow: '0 4px 14px rgba(200,149,108,0.40)' }}
            >
              {isSubmitting ? (
                <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Save Password</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#b5a898' }}>
          LeadsBase CRM &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
