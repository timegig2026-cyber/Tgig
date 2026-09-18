import { X, Trash2, Bell, Briefcase, Search, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { db, doc, updateDoc } from '../lib/firebase';
import { useAuth } from './AuthProvider';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'gig' | 'seeker' | 'system';
  createdAt: string;
}

interface NotificationsViewProps {
  onClose: () => void;
}

export default function NotificationsView({ onClose }: NotificationsViewProps) {
  const { user, profile } = useAuth();
  const notifications: Notification[] = profile?.notifications || [];

  const handleClearAll = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notifications: [],
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error clearing notifications:", e);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'gig': return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'seeker': return <Search className="w-4 h-4 text-emerald-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      <div className="p-6 flex items-center justify-between border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Notifications</h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Gigs & Seekers Updates</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {notifications.length > 0 && (
          <div className="flex justify-end">
            <button 
              onClick={handleClearAll}
              className="flex items-center space-x-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center border border-gray-100">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <div>
              <p className="text-gray-900 font-black uppercase tracking-widest text-xs">No notifications yet</p>
              <p className="text-[10px] text-gray-400 font-bold mt-1">We'll notify you when something new arrives</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((notif) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={notif.id}
                className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(notif.type)}
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{notif.title}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {notif.message}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
