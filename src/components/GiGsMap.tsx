import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, collection, onSnapshot, query, setDoc, doc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { MapPin, Plus, Briefcase, Clock, Send, X, Loader2, Globe } from 'lucide-react';

// Fix for default marker icon issue in Leaflet with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

let GigIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #111827; color: white; padding: 6px; border-radius: 8px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

let UserIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div style="background-color: #3b82f6; color: white; padding: 6px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface GiGsMapProps {
  onClose: () => void;
}

interface Gig {
  id: string;
  title: string;
  category?: string;
  description: string;
  location: { lat: number, lng: number };
  createdAt: any;
  providerId: string;
}

function LocationMarker() {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const map = useMap();

  useEffect(() => {
    (window as any).leafletMap = map;
    
    const onLocationFound = (e: L.LocationEvent) => {
      setPosition(e.latlng);
      // Only fly to location if it's the first time or triggered
      // For this app, let's just update the marker position
    };

    const onLocationError = (e: L.ErrorEvent) => {
      console.log("Location error:", e.message);
    };

    map.on("locationfound", onLocationFound);
    map.on("locationerror", onLocationError);
    
    return () => {
      map.off("locationfound", onLocationFound);
      map.off("locationerror", onLocationError);
    };
  }, [map]);

  return position === null ? null : (
    <Marker position={position} icon={UserIcon}>
      <Popup>
        <div className="text-center p-1">
          <p className="font-black text-[10px] text-gray-900 uppercase tracking-widest">You are here</p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function GiGsMap({ onClose }: GiGsMapProps) {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGigTitle, setNewGigTitle] = useState('');
  const [newGigCategory, setNewGigCategory] = useState('other');
  const [newGigDesc, setNewGigDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clickLocation, setClickLocation] = useState<[number, number] | null>(null);

  // South Africa coordinates
  const southAfricaCenter: [number, number] = [-30.5595, 22.9375];

  useEffect(() => {
    const q = query(collection(db, 'gigs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gigData: Gig[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Gig[];
      setGigs(gigData);
    });
    return unsubscribe;
  }, []);

  const handleAddGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clickLocation) return;
    setIsSubmitting(true);
    try {
      const gigRef = doc(collection(db, 'gigs'));
      await setDoc(gigRef, {
        gigId: gigRef.id,
        title: newGigTitle,
        category: newGigCategory,
        description: newGigDesc,
        location: { lat: clickLocation[0], lng: clickLocation[1] },
        providerId: user.uid,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewGigTitle('');
      setNewGigCategory('other');
      setNewGigDesc('');
      setClickLocation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gigs');
    } finally {
      setIsSubmitting(false);
    }
  };

  function MapEvents() {
    useMapEvents({
      click(e) {
        setClickLocation([e.latlng.lat, e.latlng.lng]);
        setShowAddModal(true);
      },
    });
    return null;
  }

  return (
    <div className="flex-1 bg-[#f3f4f6] flex flex-col relative w-full h-full min-h-0">
      <div className="relative w-full h-full flex-1 overflow-hidden">
        <MapContainer 
          center={southAfricaCenter} 
          zoom={5} 
          style={{ height: '100%', width: '100%', position: 'absolute', inset: 0, zIndex: 1, background: '#f3f4f6' }}
          zoomControl={false}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <LocationMarker />
          <MapEvents />

          {gigs.map((gig) => (
            <Marker 
              key={gig.id} 
              position={[gig.location.lat, gig.location.lng]}
              icon={GigIcon}
            >
              <Popup>
                <div className="p-1 space-y-2 min-w-[200px]">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-gray-900 text-white rounded-lg">
                      <Briefcase className="w-3 h-3" />
                    </div>
                    <h3 className="font-black text-gray-900 uppercase tracking-tight text-xs">{gig.title}</h3>
                  </div>
                  {gig.category && (
                    <div className="flex items-center space-x-1">
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded">
                        {gig.category}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500 font-medium leading-relaxed italic line-clamp-3">{gig.description}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-2.5 h-2.5 text-gray-400" />
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Active GiG</span>
                    </div>
                    <button className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline">Details</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Controls */}
        <div className="absolute top-4 left-4 z-[1000] space-y-3 pointer-events-none">
          <div className="bg-white px-4 py-3 rounded-2xl shadow-xl border border-gray-100 backdrop-blur-sm bg-white/95 pointer-events-auto">
             <p className="text-[10px] text-gray-900 font-black uppercase tracking-widest whitespace-nowrap">Tap map to pin a new GiG</p>
          </div>
          
          <div className="flex flex-col space-y-2 pointer-events-auto">
            <button 
              onClick={() => {
                const map = (window as any).leafletMap;
                if (map) {
                  map.flyTo([-30.5595, 22.9375], 5);
                }
              }}
              className="flex items-center space-x-2 bg-white px-4 py-2.5 rounded-xl shadow-lg border border-gray-100 text-gray-900 hover:bg-gray-50 transition-all active:scale-95"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Show South Africa</span>
            </button>
            
            <button 
              onClick={() => {
                const map = (window as any).leafletMap;
                if (map) {
                  map.locate({ setView: true, maxZoom: 13 });
                }
              }}
              className="flex items-center space-x-2 bg-white px-4 py-2.5 rounded-xl shadow-lg border border-gray-100 text-gray-900 hover:bg-gray-50 transition-all active:scale-95"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Sync My Location</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add GiG Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-900 text-white rounded-xl">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Post a GiG</h2>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddGig} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">GiG Title</label>
                  <input 
                    autoFocus
                    required
                    value={newGigTitle}
                    onChange={(e) => setNewGigTitle(e.target.value)}
                    placeholder="e.g., UI Design, Tutoring..."
                    className="w-full bg-gray-50 border-none rounded-xl py-4 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Category</label>
                    <select 
                      required
                      value={newGigCategory}
                      onChange={(e) => setNewGigCategory(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-xl py-4 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200 appearance-none"
                    >
                      <option value="car wash">Car Wash</option>
                      <option value="painting">Painting</option>
                      <option value="cleaning">Cleaning</option>
                      <option value="nanny">Nanny</option>
                      <option value="construction">Construction</option>
                      <option value="security">Security</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="electrical">Electrical</option>
                      <option value="gardening">Gardening</option>
                      <option value="delivery">Delivery</option>
                      <option value="tutoring">Tutoring</option>
                      <option value="other">Other</option>
                    </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Description</label>
                  <textarea 
                    required
                    value={newGigDesc}
                    onChange={(e) => setNewGigDesc(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full bg-gray-50 border-none rounded-xl py-4 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-gray-200 min-h-[100px]"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Post GiG at this location</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
