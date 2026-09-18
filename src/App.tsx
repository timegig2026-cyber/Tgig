import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, User as UserIcon, Search, Bell } from 'lucide-react';
import GiGsMap from './components/GiGsMap';
import ProfileView from './components/ProfileView';
import SeekersView from './components/SeekersView';
import SeekerProfileView from './components/SeekerProfileView';
import NotificationsView from './components/NotificationsView';
import { AuthProvider } from './components/AuthProvider';

import { db, doc, onSnapshot, collection, query, where, limit, updateDoc, arrayUnion } from './lib/firebase';
import { useAuth } from './components/AuthProvider';
import { OfflineIndicator } from './components/PWAControls';

type ViewType = 'gigs' | 'seekers' | 'profile' | 'notifications';

// Simple notification sound (base64 beep)
const BEEP_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTdvT18AZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTdvT18A';

function MainApp() {
  const { user, profile } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('gigs');
  const [viewingSeekerId, setViewingSeekerId] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [newGigsCount, setNewGigsCount] = useState(0);
  const [newSeekersCount, setNewSeekersCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialLoadRef = useRef(true);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio(BEEP_SOUND);
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
    }
  };

  // Notification listeners for sound and counts
  useEffect(() => {
    if (!user || !profile) return;

    // Listen for new Gigs
    const gigsQuery = query(collection(db, 'gigs'), where('createdAt', '>', profile.lastViewedGigs || new Date(0).toISOString()));
    const unsubGigs = onSnapshot(gigsQuery, (snapshot) => {
      if (!initialLoadRef.current && !snapshot.empty) {
        const newDocs = snapshot.docChanges().filter(c => c.type === 'added');
        if (newDocs.length > 0) {
          setNewGigsCount(prev => prev + newDocs.length);
          playNotificationSound();
          
          // Add to notifications array in user profile
          const lastDoc = newDocs[newDocs.length - 1].doc.data();
          updateDoc(doc(db, 'users', user.uid), {
            notifications: arrayUnion({
              id: `notif_gig_${Date.now()}`,
              title: 'New Gig Available',
              message: `A new gig "${lastDoc.title}" has been posted!`,
              type: 'gig',
              createdAt: new Date().toISOString()
            })
          });
        }
      }
    });

    // Listen for new Seekers
    const seekersQuery = query(collection(db, 'users'), where('role', '==', 'seeker'), where('createdAt', '>', profile.lastViewedSeekers || new Date(0).toISOString()));
    const unsubSeekers = onSnapshot(seekersQuery, (snapshot) => {
      if (!initialLoadRef.current && !snapshot.empty) {
        const newDocs = snapshot.docChanges().filter(c => c.type === 'added');
        if (newDocs.length > 0) {
          setNewSeekersCount(prev => prev + newDocs.length);
          playNotificationSound();

          // Add to notifications array in user profile
          const lastDoc = newDocs[newDocs.length - 1].doc.data();
          updateDoc(doc(db, 'users', user.uid), {
            notifications: arrayUnion({
              id: `notif_seeker_${Date.now()}`,
              title: 'New Seeker Joined',
              message: `${lastDoc.displayName} just joined as a seeker!`,
              type: 'seeker',
              createdAt: new Date().toISOString()
            })
          });
        }
      }
      initialLoadRef.current = false;
    });

    return () => {
      unsubGigs();
      unsubSeekers();
    };
  }, [user, profile?.lastViewedGigs, profile?.lastViewedSeekers]);

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

    // Load branding and check subscription/trial
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Trial & Subscription Logic
        const now = new Date();
        const trialActive = data.trialExpiresAt ? new Date(data.trialExpiresAt) > now : false;
        
        if (data.isTenantApproved) {
          const subActive = data.subscriptionActive === true;
          setIsSubscribed(subActive || trialActive);

          if ((subActive || trialActive) && data.branding) {
            setBranding(data.branding);
          } else {
            setBranding(null);
          }
        } else {
          // For Seekers
          const seekerSubActive = data.userSubscriptionActive === true;
          setIsSubscribed(seekerSubActive || trialActive || data.isAdmin);
          setBranding(null);
        }
      }
      // Hide splash after 5 seconds
      const timer = setTimeout(() => setShowSplash(false), 5000);
      return () => clearTimeout(timer);
    }, (error) => {
      console.warn("Could not load user profile for branding in App:", error);
      setShowSplash(false);
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
            GiGs
          </h1>
          <div className="w-12 h-1 bg-gray-900 mx-auto rounded-full animate-pulse" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Welcome to GiGs
          </p>
        </motion.div>
      </motion.div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'gigs':
        return <GiGsMap onClose={() => {}} />; 
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
      case 'notifications':
        return <NotificationsView onClose={() => setCurrentView('gigs')} />;
    }
  };

  const handleNavClick = (view: ViewType) => {
    setCurrentView(view);
    if (view === 'seekers') {
      setNewSeekersCount(0);
      if (user) updateDoc(doc(db, 'users', user.uid), { lastViewedSeekers: new Date().toISOString() });
    }
    if (view === 'gigs') {
      setNewGigsCount(0);
      if (user) updateDoc(doc(db, 'users', user.uid), { lastViewedGigs: new Date().toISOString() });
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
      <OfflineIndicator />
      
      {/* Non-intrusive Subscription Guidance Banner */}
      <AnimatePresence>
        {!isSubscribed && user && currentView !== 'profile' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white overflow-hidden relative z-[100]"
          >
            <button 
              onClick={() => handleNavClick('profile')}
              className="w-full py-3 px-4 flex items-center justify-between group active:bg-red-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Bell className="w-4 h-4 text-white animate-bounce" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Subscription Due — Update Payment in Profile</p>
              </div>
              <div className="bg-white/20 px-2 py-1 rounded text-[8px] font-black uppercase group-hover:bg-white/30 transition-colors">
                Go Now
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic View Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 flex flex-col w-full h-full transition-all duration-500">
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
        </div>
      </main>

      <div className="h-14 w-full" /> {/* Bottom spacer for fixed nav */}

      {/* Persistent Bottom Menu Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-gray-100 flex items-center justify-around px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
        <NavButton 
          active={currentView === 'seekers'} 
          onClick={() => handleNavClick('seekers')}
          icon={<Search className="w-5 h-5" />}
          label="Seekers"
          badge={newSeekersCount}
        />
        <NavButton 
          active={currentView === 'gigs'} 
          onClick={() => handleNavClick('gigs')}
          icon={<MapIcon className="w-5 h-5" />}
          label="GiGs"
          badge={newGigsCount}
        />
        <NavButton 
          active={currentView === 'notifications'} 
          onClick={() => handleNavClick('notifications')}
          icon={<Bell className="w-5 h-5" />}
          label="Alerts"
          badge={profile?.notifications?.length || 0}
        />
        <NavButton 
          active={currentView === 'profile'} 
          onClick={() => handleNavClick('profile')}
          icon={<UserIcon className="w-5 h-5" />}
          label="Profile"
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center space-y-0.5 group relative w-16"
      aria-label={label}
    >
      <div className={`p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-gray-900 text-white shadow-lg -translate-y-0.5' : 'text-gray-400 hover:bg-gray-50'}`}>
        {icon}
        {badge !== undefined && badge > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
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
