import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, User as UserIcon, Search } from 'lucide-react';
import GiGsMap from './components/GiGsMap';
import ProfileView from './components/ProfileView';
import SeekersView from './components/SeekersView';
import { AuthProvider } from './components/AuthProvider';

type ViewType = 'gigs' | 'seekers' | 'profile';

function MainApp() {
  const [currentView, setCurrentView] = useState<ViewType>('gigs');

  const renderView = () => {
    switch (currentView) {
      case 'gigs':
        return <GiGsMap onClose={() => {}} />; // Removed onClose as it's now integrated
      case 'seekers':
        return <SeekersView />;
      case 'profile':
        return <ProfileView />;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Dynamic View Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-[calc(100vh-64px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Menu Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around px-4 shadow-xl z-50">
        <NavButton 
          active={currentView === 'seekers'} 
          onClick={() => setCurrentView('seekers')}
          icon={<Search className="w-6 h-6" />}
          label="Seekers"
        />
        <NavButton 
          active={currentView === 'gigs'} 
          onClick={() => setCurrentView('gigs')}
          icon={<MapIcon className="w-6 h-6" />}
          label="GiGs"
        />
        <NavButton 
          active={currentView === 'profile'} 
          onClick={() => setCurrentView('profile')}
          icon={<UserIcon className="w-6 h-6" />}
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
      className="flex flex-col items-center justify-center space-y-1 group relative w-20"
      aria-label={label}
    >
      <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-gray-900 text-white shadow-lg -translate-y-1' : 'text-gray-400 hover:bg-gray-50'}`}>
        {icon}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${active ? 'text-gray-900' : 'text-gray-400'}`}>
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
