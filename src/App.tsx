import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, User as UserIcon, Search } from 'lucide-react';
import GiGsMap from './components/GiGsMap';
import ProfileView from './components/ProfileView';
import SeekersView from './components/SeekersView';
import SeekerProfileView from './components/SeekerProfileView';
import { AuthProvider } from './components/AuthProvider';

type ViewType = 'gigs' | 'seekers' | 'profile';

function MainApp() {
  const [currentView, setCurrentView] = useState<ViewType>('gigs');
  const [viewingSeekerId, setViewingSeekerId] = useState<string | null>(null);

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
