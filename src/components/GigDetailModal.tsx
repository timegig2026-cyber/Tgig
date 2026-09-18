import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { db, doc, collection, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, handleFirestoreError, OperationType } from '../lib/firebase';
import { Briefcase, Clock, MapPin, X, Check, Loader2, Trash2, Send, Shield, User, Phone, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Gig {
  id: string;
  title: string;
  category?: string;
  description: string;
  location: { lat: number; lng: number };
  createdAt: any;
  providerId: string;
}

export interface GigApplication {
  id: string;
  applicationId: string;
  gigId: string;
  gigOwnerId: string;
  applicantId: string;
  applicantName?: string;
  applicantPhotoURL?: string;
  applicantPhone?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'arrived' | 'completed';
  createdAt: string;
  updatedAt?: string;
}

interface GigDetailModalProps {
  gig: Gig;
  onClose: () => void;
  onGigDeleted?: () => void;
}

export default function GigDetailModal({ gig, onClose, onGigDeleted }: GigDetailModalProps) {
  const { user, profile } = useAuth();
  const [applyMessage, setApplyMessage] = useState('');
  const [applyPhone, setApplyPhone] = useState(profile?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [applications, setApplications] = useState<GigApplication[]>([]);
  const [myApplication, setMyApplication] = useState<GigApplication | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);

  const isGigOwner = Boolean(user && user.uid === gig.providerId);

  // Update phone if profile loads
  useEffect(() => {
    if (profile?.phone && !applyPhone) {
      setApplyPhone(profile.phone);
    }
  }, [profile, applyPhone]);

  // Listen to applications:
  // If owner: load all applications for this gig
  // If applicant: load user's own application for this gig
  useEffect(() => {
    if (!user) {
      setLoadingApps(false);
      return;
    }

    if (isGigOwner) {
      const q = query(
        collection(db, 'gigApplications'),
        where('gigId', '==', gig.id)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const apps = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as GigApplication[];
        setApplications(apps);
        setLoadingApps(false);
      }, (error) => {
        console.warn("Could not listen to gig applications as owner:", error);
        setLoadingApps(false);
      });
      return unsubscribe;
    } else {
      const q = query(
        collection(db, 'gigApplications'),
        where('gigId', '==', gig.id),
        where('applicantId', '==', user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          setMyApplication({ id: docSnap.id, ...docSnap.data() } as GigApplication);
        } else {
          setMyApplication(null);
        }
        setLoadingApps(false);
      }, (error) => {
        console.warn("Could not listen to user gig application:", error);
        setLoadingApps(false);
      });
      return unsubscribe;
    }
  }, [user, gig.id, isGigOwner]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isGigOwner) {
      setStatusFeedback("Error: Gig owners cannot apply to their own gigs.");
      return;
    }

    setIsSubmitting(true);
    setStatusFeedback(null);
    try {
      const appRef = doc(collection(db, 'gigApplications'));
      const appData = {
        applicationId: appRef.id,
        gigId: gig.id,
        gigOwnerId: gig.providerId,
        applicantId: user.uid,
        applicantName: profile?.displayName || user.displayName || 'Seeker',
        applicantPhotoURL: profile?.photoURL || '',
        applicantPhone: applyPhone,
        message: applyMessage,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await setDoc(appRef, appData);
      setStatusFeedback("Application submitted successfully!");
      setApplyMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gigApplications');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (appId: string, newStatus: 'accepted' | 'rejected' | 'arrived' | 'completed') => {
    try {
      await updateDoc(doc(db, 'gigApplications', appId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // Notify owner if seeker arrived
      if (newStatus === 'arrived' && myApplication) {
        const notifRef = doc(collection(db, 'users', myApplication.gigOwnerId, 'notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          title: 'Seeker Arrived!',
          message: `${myApplication.applicantName || 'A seeker'} has arrived at the GiG location: ${gig.title}`,
          type: 'gig',
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gigApplications/${appId}`);
    }
  };

  const handleNavigate = () => {
    if (!gig.location) return;
    
    navigator.geolocation.getCurrentPosition((position) => {
      const originLat = position.coords.latitude;
      const originLng = position.coords.longitude;
      const destLat = gig.location.lat;
      const destLng = gig.location.lng;
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const url = isIOS 
        ? `http://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}`
        : `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
        
      window.open(url, '_blank');
    }, (err) => {
      console.warn("Geolocation failed, using destination only", err);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${gig.location.lat},${gig.location.lng}`;
      window.open(url, '_blank');
    });
  };

  const handleDeleteGig = async () => {
    if (!window.confirm("Are you sure you want to remove this GiG from the map?")) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'gigs', gig.id));
      if (onGigDeleted) onGigDeleted();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gigs/${gig.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedDate = gig.createdAt
    ? new Date(gig.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently';

  return (
    <div className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] my-auto"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gray-900 text-white rounded-2xl shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-gray-900 tracking-tight">{gig.title}</h2>
                {isGigOwner && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[8px] font-black uppercase tracking-widest rounded-md border border-amber-200">
                    Owner
                  </span>
                )}
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                Posted {formattedDate}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Badges */}
          <div className="flex flex-wrap gap-2">
            {gig.category && (
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider rounded-xl border border-blue-100">
                {gig.category}
              </span>
            )}
            <span className="inline-flex items-center space-x-1 px-3 py-1 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl border border-gray-100">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>South Africa ({gig.location.lat.toFixed(3)}, {gig.location.lng.toFixed(3)})</span>
            </span>
            <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black uppercase tracking-wider rounded-xl border border-emerald-100">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Active</span>
            </span>
          </div>

          {/* Description */}
          <div className="space-y-2 bg-gray-50 p-5 rounded-2xl border border-gray-100">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">GiG Description</h3>
            <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
              {gig.description}
            </p>
          </div>

          {/* Owner vs Non-Owner Application Section */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            {isGigOwner ? (
              /* GIG OWNER VIEW: CANNOT APPLY TO OWN GIG */
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3">
                  <div className="p-2 bg-amber-100 rounded-xl text-amber-800 flex-shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                      You are the Owner of this GiG
                    </h4>
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      Gig owners cannot apply to their own gigs. You can manage this listing and review applications submitted by seekers below.
                    </p>
                  </div>
                </div>

                {/* Applications list for Owner */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                      Seeker Applications ({applications.length})
                    </h3>
                  </div>

                  {loadingApps ? (
                    <div className="p-6 flex items-center justify-center space-y-2">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : applications.length === 0 ? (
                    <div className="p-6 bg-gray-50 rounded-2xl text-center border border-gray-100 space-y-1">
                      <p className="text-xs font-black text-gray-600 uppercase tracking-wider">No Applications Yet</p>
                      <p className="text-[11px] text-gray-400">When seekers apply to this GiG, their profiles and messages will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {applications.map((app) => (
                        <div key={app.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                                {app.applicantPhotoURL ? (
                                  <img src={app.applicantPhotoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-gray-900">{app.applicantName || 'Seeker'}</h5>
                                {app.applicantPhone && (
                                  <div className="flex items-center space-x-1 text-[10px] text-gray-500 font-medium">
                                    <Phone className="w-3 h-3 text-gray-400" />
                                    <span>{app.applicantPhone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md ${
                              app.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {app.status}
                            </span>
                          </div>

                          {app.message && (
                            <p className="text-xs text-gray-600 font-medium italic bg-white p-3 rounded-xl border border-gray-100">
                              "{app.message}"
                            </p>
                          )}

                          {app.status === 'pending' && (
                            <div className="flex space-x-2 pt-1">
                              <button
                                onClick={() => handleUpdateStatus(app.id, 'accepted')}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(app.id, 'rejected')}
                                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Decline</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Owner Manage Button: Delete Gig */}
                <div className="pt-2">
                  <button
                    onClick={handleDeleteGig}
                    disabled={isDeleting}
                    className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border border-red-100 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>Delete / Close GiG Listing</span>
                  </button>
                </div>
              </div>
            ) : !user ? (
              /* GUEST VIEW */
              <div className="p-6 bg-gray-50 rounded-2xl text-center border border-gray-100 space-y-2">
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Sign in required</p>
                <p className="text-xs text-gray-500">Sign in with your account to apply for this GiG.</p>
              </div>
            ) : myApplication ? (
              /* ALREADY APPLIED VIEW */
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {myApplication.status === 'accepted' ? (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    ) : myApplication.status === 'arrived' ? (
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    <h4 className={`text-xs font-black uppercase tracking-wider ${
                      myApplication.status === 'accepted' ? 'text-blue-900' : 'text-emerald-900'
                    }`}>
                      {myApplication.status === 'accepted' ? 'GiG Accepted!' : 
                       myApplication.status === 'arrived' ? 'Arrived at GiG' :
                       'Application Submitted'}
                    </h4>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {myApplication.status}
                  </span>
                </div>

                {myApplication.status === 'accepted' && (
                  <div className="space-y-3">
                    <button
                      onClick={handleNavigate}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Navigate to GiG Destination</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(myApplication.id, 'arrived')}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>I've Arrived at Site</span>
                    </button>
                  </div>
                )}

                {myApplication.status === 'arrived' && (
                  <div className="p-4 bg-white/80 rounded-xl border border-emerald-100 space-y-2">
                    <p className="text-xs text-emerald-800 font-bold">You have checked in at the location.</p>
                    <p className="text-[10px] text-gray-500 font-medium italic">Please wait for the GiG owner to initiate the work or contact you.</p>
                  </div>
                )}

                {myApplication.message && (
                  <p className="text-xs text-gray-600 font-medium italic bg-white/80 p-3 rounded-xl border border-emerald-100">
                    "{myApplication.message}"
                  </p>
                )}
                <p className="text-[10px] text-emerald-700 font-bold">
                  Last updated {new Date(myApplication.updatedAt || myApplication.createdAt).toLocaleString()}
                </p>
              </div>
            ) : (
              /* NON-OWNER CAN APPLY */
              <form onSubmit={handleApply} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Apply to this GiG</h3>
                  <span className="text-[10px] text-gray-400 font-bold">Quick Submission</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={applyPhone}
                    onChange={(e) => setApplyPhone(e.target.value)}
                    placeholder="e.g. +27 12 345 6789"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-gray-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Application Pitch / Note</label>
                  <textarea
                    required
                    value={applyMessage}
                    onChange={(e) => setApplyMessage(e.target.value)}
                    placeholder="Describe your relevant experience, availability, or qualifications..."
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-xs font-medium text-gray-900 focus:ring-2 focus:ring-gray-200 min-h-[90px]"
                  />
                </div>

                {statusFeedback && (
                  <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 text-xs font-bold rounded-xl">
                    {statusFeedback}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Submit Application</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
