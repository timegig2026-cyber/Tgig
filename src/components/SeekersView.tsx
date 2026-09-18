import { useEffect, useState } from 'react';
import { db, collection, query, where, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, User as UserIcon, MapPin, Loader2, ShieldAlert } from 'lucide-react';
import SeekerProfileView from './SeekerProfileView';
import { useAuth } from './AuthProvider';
import AdminView from './AdminView';

interface Seeker {
  userId: string;
  displayName: string;
  role: string;
  bio?: string;
  photoURL?: string;
}

interface SeekersViewProps {
  onSelectSeeker: (id: string) => void;
}

export default function SeekersView({ onSelectSeeker }: SeekersViewProps) {
  const { user, profile } = useAuth();
  const [seekers, setSeekers] = useState<Seeker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  const isAdmin = profile?.isAdmin || user?.email === 'timegig2026@gmail.com';

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'seeker'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const seekersList = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      })) as Seeker[];
      setSeekers(seekersList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return unsubscribe;
  }, []);

  const filteredSeekers = seekers.filter(s => 
    s.photoURL && s.photoURL.trim() !== '' &&
    (s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.bio && s.bio.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {showAdmin && <AdminView onClose={() => setShowAdmin(false)} />}
      
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Explore Seekers</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Available in South Africa</p>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowAdmin(true)}
              className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all active:scale-95 shadow-sm border border-red-100"
            >
              <ShieldAlert className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm text-gray-900 font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-gray-200 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 text-gray-900 animate-spin" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Finding seekers...</p>
          </div>
        ) : filteredSeekers.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto border border-gray-100">
              <UserIcon className="w-10 h-10 text-gray-300" />
            </div>
            <div className="space-y-1">
              <p className="text-gray-900 font-black uppercase tracking-widest text-xs">No Results Found</p>
              <p className="text-[10px] text-gray-400 font-bold">Try adjusting your search criteria</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSeekers.map((seeker) => (
              <div 
                key={seeker.userId} 
                onClick={() => onSelectSeeker(seeker.userId)}
                className="group flex items-center p-5 bg-white border border-gray-100 rounded-[2rem] hover:border-gray-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all cursor-pointer active:scale-[0.98]"
              >
                <div className="w-14 h-14 bg-gray-100 rounded-2xl overflow-hidden mr-4 flex-shrink-0 shadow-sm">
                  {seeker.photoURL ? (
                    <img src={seeker.photoURL} alt={seeker.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon className="w-7 h-7 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-900 tracking-tight truncate">{seeker.displayName}</h4>
                  <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    <MapPin className="w-3 h-3 mr-1 text-gray-300" />
                    <span>South Africa</span>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="px-5 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg transform translate-x-2 group-hover:translate-x-0 hidden sm:block">
                    View Profile
                  </div>
                  <div className="p-2 bg-gray-50 rounded-xl sm:hidden">
                     <Search className="w-4 h-4 text-gray-900" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
