import React from 'react';
import { X, ShieldCheck, ArrowRight, LayoutDashboard } from 'lucide-react';
import { FixFlowLogo } from '../brand/FixFlowLogo';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0D201B]/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-[#F6F4EE] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#E6E4DA] text-[#24342F] animate-in fade-in zoom-in-95 duration-200">
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full text-[#687871] hover:text-[#183B32] hover:bg-[#EAE5D9] transition-colors focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo & Header */}
          <div className="text-center pt-2 pb-6 border-b border-[#E6E4DA]">
            <div className="flex justify-center mb-3">
              <FixFlowLogo size="md" />
            </div>
            <h3 className="font-editorial text-2xl text-[#183B32] font-normal">
              Sign In to FixFlow
            </h3>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DDE7DD] text-[#183B32] border border-[#CCDCCD]">
              <ShieldCheck className="w-3 h-3 text-[#183B32]" />
              Phase 1 Local Environment Active
            </div>
          </div>

          {/* Information Body */}
          <div className="py-5 space-y-3.5 text-xs sm:text-sm text-[#24342F]/80 leading-relaxed">
            <p>
              External multi-tenant user authentication (Cognito/OAuth) is planned for the cloud production release.
            </p>
            <div className="p-3.5 rounded-xl bg-white border border-[#E6E4DA] text-xs space-y-1.5 shadow-2xs">
              <p className="font-semibold text-[#183B32]">
                Full Access in Local Mode:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[#687871]">
                <li>Access all registered appliances & Digital Repair Passports</li>
                <li>Submit diagnostic fault reports & update repair status</li>
                <li>Verify SQLite database persistence & warranty documents</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => {
                onClose();
                onEnterDashboard();
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-[#183B32] hover:bg-[#122C25] rounded-full shadow-sm transition-all focus:outline-none"
            >
              <LayoutDashboard className="w-4 h-4 text-[#B69A68]" />
              <span>Enter Operational Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
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
