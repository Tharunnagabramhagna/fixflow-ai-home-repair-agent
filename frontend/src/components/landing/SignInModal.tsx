import React, { useState } from 'react';
import { X, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { FixFlowLogo } from '../brand/FixFlowLogo';
import { useAuth } from '../../context/AuthContext';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnterDashboard: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onEnterDashboard,
}) => {
  const { loginDemo } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDemoSignIn = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      await loginDemo();
      onClose();
      onEnterDashboard();
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setErrorMessage(err.message || 'Failed to authenticate session with backend server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0D201B]/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-[#F6F4EE] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E6E4DA] text-[#24342F] animate-in fade-in zoom-in-95 duration-200">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full text-[#687871] hover:text-[#183B32] hover:bg-[#EAE5D9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#183B32]"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo & Header */}
          <div className="text-center pt-2 pb-5 border-b border-[#E6E4DA]">
            <div className="flex justify-center mb-3">
              <FixFlowLogo size="md" />
            </div>
            <h3 id="signin-modal-title" className="font-editorial text-2xl text-[#183B32] font-normal">
              Sign In to FixFlow
            </h3>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DDE7DD] text-[#183B32] border border-[#CCDCCD]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#183B32]" />
              <span>Server-Managed Session Demo</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Authentication Error</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Information Body */}
          <div className="py-4 space-y-3.5 text-xs sm:text-sm text-[#24342F]/80 leading-relaxed">
            <p>
              Sign in to manage your household appliance records, track ongoing repair cases, and view persistent Digital Repair Passports.
            </p>
            <div className="p-3.5 rounded-xl bg-white border border-[#E6E4DA] text-xs space-y-1.5 shadow-2xs">
              <p className="font-semibold text-[#183B32]">
                Single-Household Prototype Model:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#687871]">
                <li>Issues an HttpOnly session cookie backed by SQLite</li>
                <li>Operates with the verified Alex Carter household identity</li>
                <li>Production multi-tenant authentication planned for cloud release</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={handleDemoSignIn}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-[#183B32] hover:bg-[#122C25] disabled:opacity-70 rounded-full shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Establishing Secure Session...</span>
                </>
              ) : (
                <>
                  <span>Continue as Demo Homeowner (Alex Carter)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={onClose}
              disabled={submitting}
              className="w-full py-2.5 text-xs font-medium text-[#7E9088] hover:text-[#183B32] transition-colors focus:outline-none"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
