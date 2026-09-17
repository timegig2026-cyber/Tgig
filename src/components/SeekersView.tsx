import { useEffect, useState } from 'react';
import { db, collection, query, where, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { Search, User as UserIcon, MapPin } from 'lucide-react';

interface Seeker {
  userId: string;
  displayName: string;
  role: string;
  bio?: string;
  photoURL?: string;
}

export default function SeekersView() {
  const [seekers, setSeekers] = useState<Seeker[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      <div className="p-6 space-y-4">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Seekers</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search seekers..."
            className="w-full bg-gray-50 border-none rounded-xl py-3 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-gray-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading seekers...</div>
        ) : seekers.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
              <UserIcon className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No seekers found yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {seekers.map((seeker) => (
              <div key={seeker.userId} className="group flex items-center p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all">
                <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden mr-4 flex-shrink-0">
                  {seeker.photoURL ? (
                    <img src={seeker.photoURL} alt={seeker.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900">{seeker.displayName}</h4>
                  <div className="flex items-center text-xs text-gray-500 mt-0.5">
                    <MapPin className="w-3 h-3 mr-1" />
                    <span>South Africa</span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-gray-50 text-gray-900 text-xs font-bold rounded-lg group-hover:bg-gray-900 group-hover:text-white transition-colors">
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
