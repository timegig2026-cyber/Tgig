import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db, doc, getDoc, collection, setDoc, query, where, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, MapPin, Phone, Globe, ArrowLeft, MessageSquare, Briefcase, Star, Loader2, Check, ExternalLink, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SeekerProfileViewProps {
  seekerId: string;
  onBack: () => void;
}

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon issue in Leaflet with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface SeekerProfile {
  userId: string;
  firstName?: string;
  surname?: string;
  displayName: string;
  bio?: string;
  phone?: string;
  socialLinks?: string[];
  photoURL?: string;
  location?: { lat: number, lng: number };
  isTenantApproved?: boolean;
}

interface HireRequest {
  id: string;
  status: 'pending' | 'accepted' | 'completed';
}

export default function SeekerProfileView({ seekerId, onBack }: SeekerProfileViewProps) {
  const { user } = useAuth();
  const [seeker, setSeeker] = useState<SeekerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState(false);
  const [hireRequest, setHireRequest] = useState<HireRequest | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    const fetchSeeker = async () => {
      try {
        const seekerDoc = await getDoc(doc(db, 'users', seekerId));
        if (seekerDoc.exists()) {
          setSeeker({ userId: seekerDoc.id, ...seekerDoc.data() } as SeekerProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${seekerId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSeeker();
  }, [seekerId]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'hires'), 
      where('requesterId', '==', user.uid),
      where('seekerId', '==', seekerId),
      where('status', 'in', ['pending', 'accepted'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        setHireRequest({ ...data, id: doc.id } as HireRequest);

        // If status just changed to accepted, trigger navigation or sound
        if (data.status === 'accepted') {
          // Play sound or navigate logic handled in a separate button or effect
        }
      } else {
        setHireRequest(null);
      }
    });
    return unsubscribe;
  }, [user, seekerId]);

  const handleHire = async () => {
    if (!user || !seeker) return;
    setHiring(true);
    try {
      const hireRef = doc(collection(db, 'hires'));
      const hireData = {
        hireId: hireRef.id,
        requesterId: user.uid,
        seekerId: seeker.userId,
        status: 'pending',
        destination: seeker.location || { lat: -30.5595, lng: 22.9375 },
        createdAt: new Date().toISOString()
      };
      await setDoc(hireRef, hireData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'hires');
    } finally {
      setHiring(false);
    }
  };

  const handleNavigate = () => {
    if (!seeker?.location) return;
    const { lat, lng } = seeker.location;
    // Open in map app
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    
    // Simulate arrival check (since we can't truly know when they arrive from web to map app)
    // In a real mobile app we'd use Geofencing. Here we'll just have a button "I've Arrived".
  };

  const speakArrival = () => {
    const utterance = new SpeechSynthesisUtterance("Arrived at destination");
    utterance.pitch = 1.2; // A bit more "lady" like if possible
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;
  if (!seeker) return <div className="flex-1 p-8 text-center text-gray-500">Seeker not found</div>;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto pb-32">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-50">
        <button onClick={onBack} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Seeker Profile</h2>
        <div className="w-9" /> {/* Spacer */}
      </div>

      {/* Profile Content */}
      <div className="p-6 space-y-8">
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div 
              onClick={() => setShowFullImage(true)}
              className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center border-4 border-white shadow-sm overflow-hidden cursor-pointer"
            >
              {seeker.photoURL ? (
                <img src={seeker.photoURL} alt={seeker.displayName} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-gray-300" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{seeker.displayName}</h2>
              {seeker.isTenantApproved && (
                <Check className="w-4 h-4 text-white bg-blue-600 rounded-full p-0.5" />
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs font-black text-gray-400 uppercase tracking-widest">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span>4.9 Seeker Rating</span>
            </div>
          </div>
        </div>

        {/* User Location Map - Matching ProfileView */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Seeker Pin Point</h3>
            <span className="text-[9px] text-gray-400 font-bold italic">Currently in South Africa</span>
          </div>
          <div className="h-40 w-full rounded-2xl overflow-hidden border-4 border-gray-50 shadow-sm relative z-0">
            <MapContainer 
              center={seeker.location || { lat: -30.5595, lng: 22.9375 }} 
              zoom={13} 
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={seeker.location || { lat: -30.5595, lng: 22.9375 }} />
            </MapContainer>
          </div>
        </div>

        {/* Info Cards */}
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">About Seeker</h3>
          <p className="text-sm text-gray-600 font-medium leading-relaxed italic">
            {seeker.bio || "No bio available yet. This seeker is ready to help with your GiGs!"}
          </p>
          
          <div className="pt-4 border-t border-gray-200 space-y-4">
             <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Location</span>
                </div>
                <span className="text-xs font-bold text-gray-900">South Africa</span>
             </div>
             
             {seeker.socialLinks && seeker.socialLinks.length > 0 && (
               <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Links</span>
                  </div>
                  <div className="flex space-x-2">
                    {seeker.socialLinks.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ))}
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Action Button */}
        <div className="fixed bottom-20 left-6 right-6 z-20">
          {hireRequest ? (
            <div className="space-y-2">
              {hireRequest.status === 'pending' ? (
                <div className="w-full bg-white border border-gray-100 p-4 rounded-2xl shadow-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Loader2 className="w-6 h-6 text-gray-900 animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight">Waiting for Seeker...</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Hiring request sent</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={handleNavigate}
                    className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 hover:bg-green-700 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Navigate to Destination</span>
                  </button>
                  <button 
                    onClick={() => {
                      speakArrival();
                      // Mark as completed in real app
                    }}
                    className="w-full bg-gray-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2"
                  >
                    <Check className="w-3 h-3" />
                    <span>I've Arrived</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={handleHire}
              disabled={hiring}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {hiring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
              <span>Hire {seeker.displayName}</span>
            </button>
          )}
        </div>
      </div>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {showFullImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6"
            onClick={() => setShowFullImage(false)}
          >
            <button className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-full">
              <X className="w-6 h-6" />
            </button>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-full max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {seeker.photoURL ? (
                <img src={seeker.photoURL} alt={seeker.displayName} className="w-full h-full object-contain" />
              ) : (
                <div className="w-64 h-64 bg-gray-800 flex items-center justify-center">
                  <User className="w-32 h-32 text-gray-700" />
                </div>
              )}
            </motion.div>
            <div className="mt-8 text-center space-y-1">
               <h3 className="text-xl font-black text-white">{seeker.displayName}</h3>
               <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Profile Identity Verified</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
