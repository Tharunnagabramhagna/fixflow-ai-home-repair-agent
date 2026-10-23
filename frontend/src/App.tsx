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
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWindowWidth } from './hooks/useWindowWidth';
import { FixFlowLogo } from './components/brand/FixFlowLogo';
import { api } from './api/client';
import type { Appliance, RepairCase, DashboardSummary } from './types';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

function FixFlowMain() {
  const { status: authStatus, user, error: authError, logout, refreshSession } = useAuth();
  const { isWideDesktop } = useWindowWidth();

  // Navigation / View mode: 'landing' vs 'dashboard'
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('app')) {
      return 'dashboard';
    }
    return 'landing';
  });

  const [currentTab, setCurrentTab] = useState('overview');

  // Sidebar responsive states
  // On wide desktop (>=1440): in-flow sidebar, expanded by default
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  // On laptop (1024-1439), tablet, mobile: drawer, closed by default
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
  const [authGateSignInOpen, setAuthGateSignInOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAllData = useCallback(async () => {
    if (authStatus !== 'authenticated') return;
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

  // Load data whenever auth status becomes authenticated
  useEffect(() => {
    if (authStatus === 'authenticated') {
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
      showToast('Signed out of FixFlow household session');
      navigateToLanding();
    } catch (err: any) {
      showToast(err.message || 'Sign out failed', 'error');
    }
  };

  // Handlers
  const handleOpenReportModal = (applianceOrText?: Appliance | string) => {
    if (typeof applianceOrText === 'string') {
      setReportDefaultAppliance(null);
    } else if (applianceOrText) {
      setReportDefaultAppliance(applianceOrText);
    } else {
      setReportDefaultAppliance(null);
    }
    setReportModalOpen(true);
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
              setAuthGateSignInOpen(true);
            }
          }}
          onReportProblem={() => {
            if (authStatus === 'authenticated') {
              navigateToDashboard('repairs');
              handleOpenReportModal();
            } else {
              setAuthGateSignInOpen(true);
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

          {/* State 2: Unauthenticated Access Gate */}
          {authStatus === 'unauthenticated' && (
            <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center p-6 text-[#24342F]">
              <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E6E4DA] shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95">
                <div className="flex justify-center">
                  <FixFlowLogo size="md" />
                </div>
                <div>
                  <h2 className="font-editorial text-2xl text-[#183B32] font-normal">
                    Authentication Required
                  </h2>
                  <p className="text-xs text-[#687871] mt-2 leading-relaxed">
                    You are attempting to access the private FixFlow homeowner dashboard. Please sign in to verify your household session.
                  </p>
                </div>
                <div className="p-3.5 bg-[#F6F4EE] rounded-2xl text-xs text-left space-y-1.5 border border-[#E6E4DA]/60">
                  <p className="font-semibold text-[#183B32]">Single-Household Prototype:</p>
                  <p className="text-[#687871]">
                    Enter as the verified demo homeowner (Alex Carter) to inspect digital repair passports and active cases.
                  </p>
                </div>
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setAuthGateSignInOpen(true)}
                    className="w-full py-3 px-4 rounded-full bg-[#183B32] hover:bg-[#122C25] text-white text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#183B32]/40"
                  >
                    <span>Sign In as Demo Homeowner</span>
                    <ArrowRight className="w-4 h-4 text-[#B69A68]" />
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
                  {authError || 'Failed to verify session status with the FixFlow backend. Please ensure the backend server is running.'}
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
                    Public Website
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* State 4: Authenticated Dashboard */}
          {authStatus === 'authenticated' && (
            <div className="flex min-h-screen bg-[#F6F4EE] text-[#24342F] font-sans">
              {/* Responsive Collapsible Sidebar */}
              <Sidebar
                currentTab={currentTab}
                onSelectTab={setCurrentTab}
                drawerOpen={drawerOpen}
                onCloseDrawer={() => setDrawerOpen(false)}
                isWideDesktop={isWideDesktop}
                desktopCollapsed={desktopCollapsed}
                onToggleDesktopCollapse={() => setDesktopCollapsed(!desktopCollapsed)}
                applianceCount={appliances.length}
                openCasesCount={openCasesCount}
                onBackToLanding={navigateToLanding}
                user={user}
                onSignOut={handleSignOut}
              />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0">
                <Header
                  currentTab={currentTab}
                  onOpenDrawer={() => setDrawerOpen(true)}
                  isWideDesktop={isWideDesktop}
                  desktopCollapsed={desktopCollapsed}
                  onOpenReportModal={() => handleOpenReportModal()}
                  onOpenRegisterModal={() => setRegisterModalOpen(true)}
                  appliances={appliances}
                  repairCases={repairCases}
                  onSelectAppliance={(a) => setPassportAppliance(a)}
                  onSelectCase={(c) => {
                    setCurrentTab('repairs');
                    setStatusModalCase(c);
                  }}
                  onOpenSettings={() => setCurrentTab('settings')}
                  user={user}
                  onSignOut={handleSignOut}
                />

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
                      onRegisterAppliance={() => setRegisterModalOpen(true)}
                    />
                  )}

                  {currentTab === 'appliances' && (
                    <AppliancesView
                      appliances={appliances}
                      repairCases={repairCases}
                      loading={loadingData}
                      onOpenRegisterModal={() => setRegisterModalOpen(true)}
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
                      onUpdateStatus={(c) => setStatusModalCase(c)}
                      onViewPassport={(a) => setPassportAppliance(a)}
                    />
                  )}

                  {currentTab === 'history' && (
                    <RepairHistoryView
                      summary={summary}
                      loading={loadingData}
                    />
                  )}

                  {currentTab === 'settings' && <SettingsView onNavigateTab={setCurrentTab} />}
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

      {/* Auth Gate Sign In Modal */}
      <SignInModal
        isOpen={authGateSignInOpen}
        onClose={() => setAuthGateSignInOpen(false)}
        onEnterDashboard={() => navigateToDashboard('overview')}
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

