import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, User as UserIcon, Search, CreditCard } from 'lucide-react';
import GiGsMap from './components/GiGsMap';
import ProfileView from './components/ProfileView';
import SeekersView from './components/SeekersView';
import SeekerProfileView from './components/SeekerProfileView';
import { AuthProvider } from './components/AuthProvider';

import { db, doc, onSnapshot } from './lib/firebase';
import { useAuth } from './components/AuthProvider';

type ViewType = 'gigs' | 'seekers' | 'profile';

function MainApp() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('gigs');
  const [viewingSeekerId, setViewingSeekerId] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(true);

  // Capture tenant referral link from URL
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tenantRef = urlParams.get('tenant') || urlParams.get('ref') || urlParams.get('tenantId');
      if (tenantRef) {
        localStorage.setItem('tenant_ref', tenantRef);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setShowSplash(false);
      setIsSubscribed(true);
      return;
    }

    // Load branding if user is a tenant
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.isTenantApproved) {
          // Check subscription status
          const active = data.subscriptionActive === true;
          setIsSubscribed(active);

          if (active && data.branding) {
            setBranding(data.branding);
          } else {
            setBranding(null); // Clear branding if inactive
          }
        } else {
          setIsSubscribed(true); // Not a tenant, no block
          setBranding(null);
        }
      }
      // Hide splash after 5 seconds
      const timer = setTimeout(() => setShowSplash(false), 5000);
      return () => clearTimeout(timer);
    });

    return () => unsub();
  }, [user]);

  if (showSplash && branding) {
    return (
      <motion.div 
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[5000] bg-white flex flex-col items-center justify-center p-12 text-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-8"
        >
          <h1 
            style={{ 
              fontFamily: branding.fontFamily,
              fontSize: branding.fontSize,
              color: branding.fontColor
            }}
            className="font-black leading-tight"
          >
            {branding.appName || 'TimeGig'}
          </h1>
          <div className="w-12 h-1 bg-gray-900 mx-auto rounded-full animate-pulse" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Welcome to {branding.appName || 'TimeGig'}
          </p>
        </motion.div>
      </motion.div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'gigs':
        return <GiGsMap onClose={() => {}} />; // Removed onClose as it's now integrated
      case 'seekers':
        return <SeekersView onSelectSeeker={(id) => {
          setViewingSeekerId(id);
          setCurrentView('profile');
        }} />;
      case 'profile':
        if (viewingSeekerId) {
          return <SeekerProfileView seekerId={viewingSeekerId} onBack={() => setViewingSeekerId(null)} />;
        }
        return <ProfileView />;
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
      {/* Dynamic View Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col w-full h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="h-14 w-full" /> {/* Bottom spacer for fixed nav */}

      {/* Persistent Bottom Menu Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-100 flex items-center justify-around px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
        <NavButton 
          active={currentView === 'seekers'} 
          onClick={() => setCurrentView('seekers')}
          icon={<Search className="w-5 h-5" />}
          label="Seekers"
        />
        <NavButton 
          active={currentView === 'gigs'} 
          onClick={() => setCurrentView('gigs')}
          icon={<MapIcon className="w-5 h-5" />}
          label="GiGs"
        />
        <NavButton 
          active={currentView === 'profile'} 
          onClick={() => setCurrentView('profile')}
          icon={<UserIcon className="w-5 h-5" />}
          label="Profile"
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center space-y-0.5 group relative w-16"
      aria-label={label}
    >
      <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-gray-900 text-white shadow-lg -translate-y-0.5' : 'text-gray-400 hover:bg-gray-50'}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${active ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute -bottom-2 w-1 h-1 bg-gray-900 rounded-full"
        />
      )}
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
