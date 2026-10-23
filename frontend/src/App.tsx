import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './views/OverviewView';
import { AppliancesView } from './views/AppliancesView';
import { RepairCasesView } from './views/RepairCasesView';
import { RepairHistoryView } from './views/RepairHistoryView';
import { SettingsView } from './views/SettingsView';
import { SystemHealthView } from './views/SystemHealthView';
import { PublicLandingPage } from './components/landing/PublicLandingPage';
import { AppliancePassportModal } from './components/AppliancePassportModal';
import { ReportProblemModal } from './components/ReportProblemModal';
import { RegisterApplianceModal } from './components/RegisterApplianceModal';
import { StatusUpdateModal } from './components/StatusUpdateModal';
import { SignInModal } from './components/landing/SignInModal';
import { AssistantPanel } from './components/AssistantPanel';
import { AlexaSimulatorModal } from './components/AlexaSimulatorModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWindowWidth } from './hooks/useWindowWidth';
import { FixFlowLogo } from './components/brand/FixFlowLogo';
import { api } from './api/client';
import type { Appliance, RepairCase, DashboardSummary } from './types';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Compass,
  Sparkles,
  ShieldAlert,
  UserPlus,
  LogIn,
  X,
  Mic,
} from 'lucide-react';

function FixFlowMain() {
  const {
    status: authStatus,
    user,
    error: authError,
    logout,
    refreshSession,
    continueAsGuest,
    isGuest,
  } = useAuth();
  const { isDesktop, isWideDesktop } = useWindowWidth();

  // Navigation / View mode: 'landing' vs 'dashboard'
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('app')) {
      return 'dashboard';
    }
    return 'landing';
  });

  const [currentTab, setCurrentTab] = useState('overview');

  // Sidebar responsive states
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Data states
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [repairCases, setRepairCases] = useState<RepairCase[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal states
  const [passportAppliance, setPassportAppliance] = useState<Appliance | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportDefaultAppliance, setReportDefaultAppliance] = useState<Appliance | null>(null);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [statusModalCase, setStatusModalCase] = useState<RepairCase | null>(null);
  
  // Auth Modal states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'signin' | 'register'>('signin');
  const [isAlexaModalOpen, setIsAlexaModalOpen] = useState(false);

  // Guest action prompt modal (when a guest clicks an account-only action)
  const [guestPrompt, setGuestPrompt] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openAuthModal = (mode: 'signin' | 'register' = 'signin') => {
    setAuthModalInitialMode(mode);
    setAuthModalOpen(true);
  };

  const loadAllData = useCallback(async () => {
    if (authStatus !== 'authenticated' && authStatus !== 'guest') return;
    try {
      setLoadingData(true);
      const [sumData, appsData, casesData] = await Promise.all([
        api.getDashboardSummary(),
        api.getAppliances(),
        api.getRepairs(),
      ]);
      setSummary(sumData);
      setAppliances(appsData);
      setRepairCases(casesData);
    } catch (err: any) {
      console.error('Failed to load FixFlow dashboard data', err);
      showToast(err.message || 'Failed to load household repair data', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [authStatus]);

  // Load data whenever auth status becomes authenticated or guest
  useEffect(() => {
    if (authStatus === 'authenticated' || authStatus === 'guest') {
      loadAllData();
    }
  }, [authStatus, loadAllData]);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.includes('app')) {
        setViewMode('dashboard');
      } else {
        setViewMode('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToDashboard = (tab: string = 'overview') => {
    setCurrentTab(tab);
    setViewMode('dashboard');
    window.location.hash = '#/app';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLanding = () => {
    setViewMode('landing');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = async () => {
    try {
      await logout();
      showToast('Signed out of FixFlow');
      navigateToLanding();
    } catch (err: any) {
      showToast(err.message || 'Sign out failed', 'error');
    }
  };

  // Safe action triggers with guest intercept
  const handleOpenReportModal = (applianceOrText?: Appliance | string) => {
    if (isGuest) {
      setGuestPrompt({
        title: 'Create an Account to Report Repairs',
        description:
          'You are currently exploring FixFlow as a guest. To file active repair tickets, diagnose issues with AI triage, and track technician progress for your household, please create a free account.',
      });
      return;
    }
    if (typeof applianceOrText === 'string') {
      setReportDefaultAppliance(null);
    } else if (applianceOrText) {
      setReportDefaultAppliance(applianceOrText);
    } else {
      setReportDefaultAppliance(null);
    }
    setReportModalOpen(true);
  };

  const handleOpenRegisterModal = () => {
    if (isGuest) {
      setGuestPrompt({
        title: 'Create an Account to Register Appliances',
        description:
          'You are currently exploring FixFlow in Guest Mode with sample appliances. Creating a free account lets you register your household equipment, store digital warranties, and generate permanent repair passports.',
      });
      return;
    }
    setRegisterModalOpen(true);
  };

  const handleOpenStatusModal = (c: RepairCase) => {
    if (isGuest) {
      setGuestPrompt({
        title: 'Create an Account to Update Repair Status',
        description:
          'Sample repair cases cannot be modified in Guest Mode. Please sign in or register to manage your household repair workflow.',
      });
      return;
    }
    setStatusModalCase(c);
  };

  const handleCaseUpdated = () => {
    loadAllData();
    showToast('Case status updated and audit event recorded');
  };

  const handleApplianceCreated = () => {
    loadAllData();
    showToast('Appliance registered and Repair Passport initialized');
  };

  const handleReportCreated = () => {
    loadAllData();
    showToast('Repair ticket created successfully');
  };

  const openCasesCount = repairCases.filter((c) =>
    ['open', 'diagnosed', 'scheduled', 'in_progress'].includes(c.status)
  ).length;

  return (
    <div className="min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-bounce ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* View Mode Switching: Public Landing vs. Dashboard */}
      {viewMode === 'landing' ? (
        <PublicLandingPage
          appliances={appliances}
          onLaunchDashboard={() => navigateToDashboard('overview')}
          onRegisterAppliance={() => {
            if (authStatus === 'authenticated') {
              navigateToDashboard('appliances');
              setRegisterModalOpen(true);
            } else {
              openAuthModal('register');
            }
          }}
          onReportProblem={() => {
            if (authStatus === 'authenticated') {
              navigateToDashboard('repairs');
              handleOpenReportModal();
            } else {
              openAuthModal('signin');
            }
          }}
          onOpenPassport={(appliance) => setPassportAppliance(appliance)}
        />
      ) : (
        /* Dashboard View Mode */
        <>
          {/* State 1: Verifying session */}
          {authStatus === 'loading' && (
            <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center p-6 text-[#24342F]">
              <FixFlowLogo size="lg" />
              <div className="mt-6 flex items-center gap-3 text-sm text-[#687871]">
                <Loader2 className="w-5 h-5 animate-spin text-[#183B32]" />
                <span>Verifying household session...</span>
              </div>
            </div>
          )}

          {/* State 2: Unauthenticated Access Gate (When user opens #/app directly without auth) */}
          {authStatus === 'unauthenticated' && (
            <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center p-6 text-[#24342F] relative overflow-hidden">
              {/* Subtle ambient lighting */}
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#183B32]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-[#B49A68]/15 rounded-full blur-3xl pointer-events-none" />

              <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-3xl p-8 border border-[#E6E4DA] shadow-[0_20px_50px_rgba(24,59,50,0.12)] text-center space-y-5 animate-in fade-in zoom-in-95 relative z-10">
                <div className="flex justify-center">
                  <FixFlowLogo size="md" />
                </div>
                <div>
                  <h2 className="font-editorial text-2xl text-[#183B32] font-normal">
                    FixFlow Homeowner Workspace
                  </h2>
                  <p className="text-xs text-[#687871] mt-2 leading-relaxed">
                    Sign in to manage your registered household appliances, or explore FixFlow as a guest without creating an account.
                  </p>
                </div>

                <div className="p-3.5 bg-[#F6F4EE]/80 rounded-2xl text-xs text-left space-y-1.5 border border-[#E6E4DA]/60">
                  <div className="flex items-center gap-2 text-[#183B32] font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-[#B49A68]" />
                    <span>Explore or Manage:</span>
                  </div>
                  <ul className="text-[#687871] space-y-1 pl-5 list-disc">
                    <li>Digital Repair Passports and appliance specs</li>
                    <li>Active repair cases and lifecycle timeline</li>
                    <li>Full guest exploration mode with sample data</li>
                  </ul>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={() => openAuthModal('signin')}
                    className="w-full py-3 px-4 rounded-full bg-[#183B32] hover:bg-[#122C25] text-white text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
                  >
                    <LogIn className="w-4 h-4 text-[#B69A68]" />
                    <span>Sign In to Account</span>
                  </button>

                  <button
                    onClick={() => {
                      continueAsGuest();
                      navigateToDashboard('overview');
                    }}
                    className="w-full py-3 px-4 rounded-full bg-white hover:bg-[#F6F4EE] border border-[#CBDBCB] text-[#183B32] text-sm font-semibold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#183B32]/30"
                  >
                    <Compass className="w-4 h-4 text-[#2D6A4F]" />
                    <span>Continue as Guest</span>
                  </button>

                  <button
                    onClick={navigateToLanding}
                    className="w-full py-2.5 text-xs font-medium text-[#7E9088] hover:text-[#183B32] transition-colors focus:outline-none"
                  >
                    Return to Public Website
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* State 3: Session verification error */}
          {authStatus === 'error' && (
            <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center p-6 text-[#24342F]">
              <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200 shadow-xl text-center space-y-4">
                <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
                <h2 className="text-lg font-bold text-[#183B32]">Connection Error</h2>
                <p className="text-xs text-[#687871] leading-relaxed">
                  {authError ||
                    'Failed to verify session status with the FixFlow backend. Please ensure the backend server is running.'}
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={() => refreshSession()}
                    className="py-2.5 px-6 rounded-full bg-[#183B32] text-white text-xs font-semibold hover:bg-[#102D27] transition-colors"
                  >
                    Retry Connection
                  </button>
                  <button
                    onClick={navigateToLanding}
                    className="py-2.5 px-4 rounded-full border border-[#E6E4DA] text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Back to Home Page
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* State 4: Active Dashboard (Authenticated or Guest Workspace) */}
          {(authStatus === 'authenticated' || authStatus === 'guest') && (
            <div className="flex min-h-screen bg-[#F6F4EE] text-[#24342F] font-sans">
              {/* Responsive Collapsible Sidebar */}
              <Sidebar
                currentTab={currentTab}
                onSelectTab={setCurrentTab}
                drawerOpen={drawerOpen}
                onCloseDrawer={() => setDrawerOpen(false)}
                isDesktop={isDesktop}
                isWideDesktop={isWideDesktop}
                desktopCollapsed={desktopCollapsed}
                onToggleDesktopCollapse={() => setDesktopCollapsed(!desktopCollapsed)}
                applianceCount={appliances.length}
                openCasesCount={openCasesCount}
                onBackToLanding={navigateToLanding}
                user={user}
                onSignOut={handleSignOut}
                onOpenAuthModal={() => openAuthModal('signin')}
              />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0">
                <Header
                  currentTab={currentTab}
                  onOpenDrawer={() => setDrawerOpen(true)}
                  isDesktop={isDesktop}
                  isWideDesktop={isWideDesktop}
                  desktopCollapsed={desktopCollapsed}
                  onToggleDesktopCollapse={() => setDesktopCollapsed(!desktopCollapsed)}
                  onOpenReportModal={() => handleOpenReportModal()}
                  onOpenRegisterModal={handleOpenRegisterModal}
                  appliances={appliances}
                  repairCases={repairCases}
                  onSelectAppliance={(a) => setPassportAppliance(a)}
                  onSelectCase={(c) => {
                    setCurrentTab('repairs');
                    handleOpenStatusModal(c);
                  }}
                  onOpenSettings={() => setCurrentTab('settings')}
                  user={user}
                  onSignOut={handleSignOut}
                  onOpenAuthModal={() => openAuthModal('signin')}
                />

                {/* Guest Exploration Workspace Banner */}
                {isGuest && (
                  <div className="bg-[#183B32]/5 border-b border-[#183B32]/10 px-4 sm:px-6 py-2.5 backdrop-blur-xs">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2 text-[#183B32]">
                        <Compass className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                        <span>
                          <strong>Guest Mode:</strong> You are exploring FixFlow sample appliances and passports. Changes are not saved permanently.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => openAuthModal('register')}
                          className="px-3 py-1 rounded-full bg-[#183B32] hover:bg-[#122C25] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <UserPlus className="w-3 h-3 text-[#B49A68]" />
                          <span>Create Free Account</span>
                        </button>
                        <button
                          onClick={() => openAuthModal('signin')}
                          className="px-3 py-1 rounded-full border border-[#CBDBCB] hover:bg-white text-[#183B32] text-xs font-semibold transition-colors"
                        >
                          Sign In
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                  {currentTab === 'overview' && (
                    <OverviewView
                      summary={summary}
                      appliances={appliances}
                      repairCases={repairCases}
                      loading={loadingData}
                      onNavigateTab={setCurrentTab}
                      onViewPassport={(a) => setPassportAppliance(a)}
                      onReportIssue={handleOpenReportModal}
                      onRegisterAppliance={handleOpenRegisterModal}
                      onRefreshData={loadAllData}
                    />
                  )}

                  {currentTab === 'appliances' && (
                    <AppliancesView
                      appliances={appliances}
                      repairCases={repairCases}
                      loading={loadingData}
                      onOpenRegisterModal={handleOpenRegisterModal}
                      onViewPassport={(a) => setPassportAppliance(a)}
                      onReportIssue={handleOpenReportModal}
                    />
                  )}

                  {currentTab === 'repairs' && (
                    <RepairCasesView
                      repairCases={repairCases}
                      appliances={appliances}
                      loading={loadingData}
                      onOpenReportModal={() => handleOpenReportModal()}
                      onUpdateStatus={(c) => handleOpenStatusModal(c)}
                      onViewPassport={(a) => setPassportAppliance(a)}
                    />
                  )}

                  {currentTab === 'history' && (
                    <RepairHistoryView
                      summary={summary}
                      loading={loadingData}
                    />
                  )}

                  {currentTab === 'assistant' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h1 className="text-2xl sm:text-3xl font-bold text-[#183B32] tracking-tight">
                            AI Repair Assistant
                          </h1>
                          <p className="text-sm text-[#687871] mt-1">
                            Natural language appliance diagnostics, warranty verification, and repair proposals.
                          </p>
                        </div>
                        <button
                          onClick={() => setIsAlexaModalOpen(true)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 flex items-center space-x-2 transition-all self-start sm:self-auto"
                        >
                          <Mic className="w-4 h-4 animate-pulse text-blue-200" />
                          <span>Alexa Voice Simulator</span>
                        </button>
                      </div>
                      <div className="h-[680px] w-full">
                        <AssistantPanel
                          appliances={appliances}
                          onOpenReportModal={handleOpenReportModal}
                          onNavigateTab={setCurrentTab}
                          onViewPassport={(a) => setPassportAppliance(a)}
                          onRefreshData={loadAllData}
                        />
                      </div>
                    </div>
                  )}

                  {currentTab === 'settings' && (
                    <SettingsView
                      onNavigateTab={setCurrentTab}
                      onOpenAuthModal={() => openAuthModal('register')}
                    />
                  )}
                  {currentTab === 'health' && <SystemHealthView />}
                </main>
              </div>
            </div>
          )}
        </>
      )}

      {/* Universal Modals */}
      <AppliancePassportModal
        appliance={passportAppliance}
        onClose={() => setPassportAppliance(null)}
        onReportIssue={(a) => {
          setPassportAppliance(null);
          handleOpenReportModal(a);
        }}
      />

      <ReportProblemModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        appliances={appliances}
        defaultAppliance={reportDefaultAppliance}
        onSuccess={handleReportCreated}
      />

      <RegisterApplianceModal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={handleApplianceCreated}
      />

      {statusModalCase && (
        <StatusUpdateModal
          repairCase={statusModalCase}
          onClose={() => setStatusModalCase(null)}
          onSuccess={handleCaseUpdated}
        />
      )}

      {/* Guest Mode Action Prompt Modal */}
      {guestPrompt && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-[#0A1612]/60 backdrop-blur-md transition-opacity"
            onClick={() => setGuestPrompt(null)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/80 text-[#24342F] z-10 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setGuestPrompt(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-[#687871] hover:text-[#183B32] hover:bg-[#EAE5D9]/60 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-[#B49A68]/15 border border-[#B49A68]/30 flex items-center justify-center text-[#B49A68] mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#183B32]">{guestPrompt.title}</h3>
            <p className="text-xs text-[#687871] mt-2 leading-relaxed">
              {guestPrompt.description}
            </p>
            <div className="mt-6 space-y-2">
              <button
                onClick={() => {
                  setGuestPrompt(null);
                  openAuthModal('register');
                }}
                className="w-full py-3 px-4 rounded-full bg-[#183B32] hover:bg-[#122C25] text-white text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-[#B49A68]" />
                <span>Create Free Account</span>
              </button>
              <button
                onClick={() => {
                  setGuestPrompt(null);
                  openAuthModal('signin');
                }}
                className="w-full py-2.5 px-4 rounded-full border border-[#CBDBCB] text-[#183B32] text-xs font-semibold hover:bg-[#F6F4EE] transition-colors"
              >
                Sign In to Existing Account
              </button>
              <button
                onClick={() => setGuestPrompt(null)}
                className="w-full py-2 text-xs font-medium text-[#7E9088] hover:text-[#183B32] transition-colors"
              >
                Continue Exploring as Guest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal (Sign In & Register) */}
      <SignInModal
        isOpen={authModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onEnterDashboard={() => navigateToDashboard('overview')}
      />

      {/* Alexa Voice Assistant Simulator Modal (Phase 4) */}
      <AlexaSimulatorModal
        isOpen={isAlexaModalOpen}
        onClose={() => setIsAlexaModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FixFlowMain />
    </AuthProvider>
  );
}

