import React, { useState } from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingFeatures } from './LandingFeatures';
import { LandingHowItWorks } from './LandingHowItWorks';
import { LandingPassportPreview } from './LandingPassportPreview';
import { LandingTrustOrganization } from './LandingTrustOrganization';
import { LandingCTA } from './LandingCTA';
import { LandingFooter } from './LandingFooter';
import { SignInModal } from './SignInModal';
import { useAuth } from '../../context/AuthContext';
import type { Appliance } from '../../types';

interface PublicLandingPageProps {
  appliances: Appliance[];
  onLaunchDashboard: () => void;
  onRegisterAppliance: () => void;
  onReportProblem: () => void;
  onOpenPassport: (appliance: Appliance) => void;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  appliances,
  onLaunchDashboard,
  onRegisterAppliance,
  onReportProblem,
  onOpenPassport,
}) => {
  const [signInOpen, setSignInOpen] = useState(false);
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  // Default sample appliance for "View Appliance Record" CTA in Hero (Samsung Refrigerator or first appliance)
  const sampleAppliance: Appliance =
    appliances.find((a) => a.id === 'demo-app-001') ||
    appliances[0] ||
    ({
      id: 'demo-app-001',
      name: 'Kitchen Refrigerator',
      brand: 'Samsung',
      model: 'RF28R7551SR',
      serial_number: 'SN-RF28-20230415',
      category: 'Kitchen',
      location: 'Kitchen',
      purchase_date: '2023-04-15',
      warranty_expiration: '2027-03-31',
      notes: 'French door, stainless steel finish',
      created_at: '2026-10-22',
      updated_at: '2026-10-22',
    });

  const handleHeroViewSamplePassport = () => {
    onOpenPassport(sampleAppliance);
  };

  const handleExploreClick = () => {
    const el = document.getElementById('how-it-works');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRegisterOrSignIn = () => {
    if (isAuthenticated) {
      onRegisterAppliance();
    } else {
      setSignInOpen(true);
    }
  };

  const handleReportOrSignIn = () => {
    if (isAuthenticated) {
      onReportProblem();
    } else {
      setSignInOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-[#24342F] flex flex-col font-sans selection:bg-[#DDE7DD] selection:text-[#183B32]">
      {/* Editorial Navigation Header */}
      <LandingHeader
        onRegisterClick={handleRegisterOrSignIn}
        onSignInClick={() => setSignInOpen(true)}
        onOpenDashboard={onLaunchDashboard}
      />

      {/* Main Public Website Sections */}
      <main className="flex-1">
        {/* Hero Section */}
        <LandingHero
          onRegisterClick={handleRegisterOrSignIn}
          onExploreClick={handleExploreClick}
          onViewSamplePassport={handleHeroViewSamplePassport}
        />

        {/* Section A: Core Benefits (3 Columns) */}
        <LandingFeatures />

        {/* Section B: How It Works (3 Steps) */}
        <LandingHowItWorks
          onRegisterClick={handleRegisterOrSignIn}
          onReportClick={handleReportOrSignIn}
        />

        {/* Section C: Repair Passport Signature Feature Showcase */}
        <LandingPassportPreview
          appliances={appliances}
          onOpenPassport={onOpenPassport}
          onLaunchDashboard={onLaunchDashboard}
        />

        {/* Section D: Trust & Organization */}
        <LandingTrustOrganization />

        {/* Section E: Final Call to Action */}
        <LandingCTA
          onRegisterClick={handleRegisterOrSignIn}
          onExploreClick={handleExploreClick}
        />
      </main>

      {/* Footer */}
      <LandingFooter
        onRegisterClick={handleRegisterOrSignIn}
        onSignInClick={() => setSignInOpen(true)}
      />

      {/* Sign In / Local Environment Modal */}
      <SignInModal
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        onEnterDashboard={onLaunchDashboard}
      />
    </div>
  );
};
