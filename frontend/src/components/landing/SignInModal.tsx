import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Compass,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { FixFlowLogo } from '../brand/FixFlowLogo';
import { useAuth } from '../../context/AuthContext';

export interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterDashboard: () => void;
  initialMode?: 'signin' | 'register';
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onEnterDashboard,
  initialMode = 'signin',
}) => {
  const { login, register, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotPasswordNote, setShowForgotPasswordNote] = useState(false);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowForgotPasswordNote(false);
    }
  }, [isOpen, initialMode]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!email.trim() || !password) {
      setErrorMessage('Please provide both your email address and password.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await login({ email: email.trim(), password });
      setSuccessMessage('Signed in successfully.');
      setTimeout(() => {
        onClose();
        onEnterDashboard();
      }, 350);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setErrorMessage(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setSuccessMessage('Account created successfully.');
      setTimeout(() => {
        onClose();
        onEnterDashboard();
      }, 400);
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(err.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestContinue = () => {
    continueAsGuest();
    onClose();
    onEnterDashboard();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Soft Blurred Backdrop with Warm Ambient Glow */}
      <div
        className="fixed inset-0 bg-[#0A1612]/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
        onClick={() => {
          if (!submitting) onClose();
        }}
        aria-hidden="true"
      />

      {/* Floating Glassmorphism Authentication Card */}
      <div className="relative w-full max-w-md bg-white/90 sm:bg-[#FDFCF7]/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(24,59,50,0.25)] border border-white/80 text-[#24342F] z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Subtle Decorative Ambient Gradient Highlights */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#B49A68]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#183B32]/12 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-5 right-5 p-2 rounded-full text-[#687871] hover:text-[#183B32] hover:bg-[#EAE5D9]/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32] disabled:opacity-50"
          aria-label="Close authentication dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Logo */}
        <div className="text-center pt-1 pb-4">
          <div className="flex justify-center mb-2.5">
            <FixFlowLogo size="md" />
          </div>
          <h3 id="auth-modal-title" className="font-editorial text-2xl text-[#183B32] font-normal tracking-tight">
            {mode === 'signin' ? 'Welcome Back' : 'Create an Account'}
          </h3>
          <p className="text-xs text-[#687871] mt-1 max-w-xs mx-auto">
            {mode === 'signin'
              ? 'Sign in to access your appliances, repair cases, and Digital Repair Passports.'
              : 'Register to organize household appliances and maintain lifetime repair records.'}
          </p>
        </div>

        {/* Tab Switcher: Sign In vs. Create Account */}
        <div className="flex bg-[#EAE5D9]/60 p-1 rounded-2xl mb-4 text-xs font-semibold border border-[#E6E4DA]/60">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'signin'
                ? 'bg-white text-[#183B32] shadow-2xs font-bold'
                : 'text-[#687871] hover:text-[#183B32]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white text-[#183B32] shadow-2xs font-bold'
                : 'text-[#687871] hover:text-[#183B32]'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 leading-relaxed">
              <p className="font-semibold text-[11px] uppercase tracking-wider text-rose-900">Authentication Error</p>
              <p className="mt-0.5 text-xs text-rose-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium text-xs text-emerald-800">{successMessage}</span>
          </div>
        )}

        {/* Informative Note for Forgot Password */}
        {showForgotPasswordNote && (
          <div className="mb-4 p-3 rounded-2xl bg-[#EEF4EE] border border-[#CBDBCB] text-xs text-[#24342F] space-y-1 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 font-semibold text-[#183B32]">
              <HelpCircle className="w-3.5 h-3.5 text-[#183B32]" />
              <span>Password Recovery</span>
            </div>
            <p className="text-[11px] text-[#687871] leading-relaxed">
              Self-service password recovery is planned for the upcoming cloud release. For prototype evaluation, you may register a new test account or contact your team administrator.
            </p>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={mode === 'signin' ? handleSignIn : handleRegister} className="space-y-3.5">
          {/* Full Name Field (Registration Only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-[#4A5D54] uppercase tracking-wider mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#8A9A92] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  disabled={submitting}
                  className="w-full bg-white border border-[#E6E4DA] focus:border-[#183B32] focus:ring-1 focus:ring-[#183B32] rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#24342F] placeholder-[#A3B2AA] focus:outline-none transition-all shadow-2xs disabled:bg-slate-50"
                />
              </div>
            </div>
          )}

          {/* Email Address Field */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5D54] uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8A9A92] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={submitting}
                className="w-full bg-white border border-[#E6E4DA] focus:border-[#183B32] focus:ring-1 focus:ring-[#183B32] rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-[#24342F] placeholder-[#A3B2AA] focus:outline-none transition-all shadow-2xs disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-[#4A5D54] uppercase tracking-wider">
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordNote(!showForgotPasswordNote)}
                  className="text-[11px] font-semibold text-[#183B32] hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8A9A92] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                disabled={submitting}
                className="w-full bg-white border border-[#E6E4DA] focus:border-[#183B32] focus:ring-1 focus:ring-[#183B32] rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#24342F] placeholder-[#A3B2AA] focus:outline-none transition-all shadow-2xs disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9A92] hover:text-[#183B32] p-1 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field (Registration Only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold text-[#4A5D54] uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8A9A92] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={submitting}
                  className="w-full bg-white border border-[#E6E4DA] focus:border-[#183B32] focus:ring-1 focus:ring-[#183B32] rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#24342F] placeholder-[#A3B2AA] focus:outline-none transition-all shadow-2xs disabled:bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A9A92] hover:text-[#183B32] p-1 focus:outline-none"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Remember Me Checkbox (Sign In Only) */}
          {mode === 'signin' && (
            <div className="flex items-center gap-2 pt-0.5">
              <input
                id="remember-me-checkbox"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-[#183B32] focus:ring-[#183B32] border-[#CBDBCB] accent-[#183B32]"
              />
              <label htmlFor="remember-me-checkbox" className="text-xs text-[#687871] select-none cursor-pointer">
                Keep me signed in on this device
              </label>
            </div>
          )}

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold text-white bg-[#183B32] hover:bg-[#122C25] disabled:opacity-70 rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#183B32]/40 active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#B69A68]" />
                <span>{mode === 'signin' ? 'Authenticating...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In to FixFlow' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4 text-[#B69A68]" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-[#E6E4DA] w-full" />
          <span className="bg-[#FDFCF7] px-3 text-[11px] font-medium text-[#8A9A92] uppercase tracking-wider absolute">
            or
          </span>
        </div>

        {/* Visually Distinct Genuine Guest Access */}
        <button
          type="button"
          onClick={handleGuestContinue}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border border-[#183B32]/30 bg-[#EEF4EE]/60 hover:bg-[#EEF4EE] hover:border-[#183B32] text-[#183B32] text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
        >
          <Compass className="w-4 h-4 text-[#183B32]" />
          <span>Continue as Guest — Explore without an account</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* Footer Mode Switch Link */}
        <div className="mt-4 text-center text-xs text-[#687871]">
          {mode === 'signin' ? (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className="font-bold text-[#183B32] hover:underline focus:outline-none"
              >
                Create one now
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                }}
                className="font-bold text-[#183B32] hover:underline focus:outline-none"
              >
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
