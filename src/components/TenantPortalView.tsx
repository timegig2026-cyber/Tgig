import { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, updateDoc, doc, where } from '../lib/firebase';
import { 
  Users, ShieldCheck, DollarSign, ArrowLeft, Check, X, FileText, Loader2, 
  TrendingUp, Search, Palette, Eye, CreditCard, Upload, Lock, Copy, CheckCircle2, 
  Share2, Link as LinkIcon, UserCheck, Calendar, Clock, AlertCircle, RefreshCw,
  ExternalLink, UserX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';

interface Payment {
  paymentId: string;
  userId: string;
  tenantId: string;
  userDisplayName: string;
  userPhotoURL?: string;
  proofImage: string;
  amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface TenantUser {
  userId: string;
  displayName: string;
  role: string;
  photoURL?: string;
  phone?: string;
  createdAt: string;
  tenantId?: string;
  tenantApproved?: boolean;
  userSubscriptionActive?: boolean;
  userSubscriptionExpiresAt?: string;
  latestPayment?: Payment;
  isApproved?: boolean;
}

interface TenantPortalViewProps {
  onClose: () => void;
  initialTab?: 'overview' | 'users' | 'pop' | 'branding' | 'subscription';
}

export default function TenantPortalView({ onClose, initialTab = 'overview' }: TenantPortalViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pop' | 'branding' | 'subscription'>(initialTab);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingPop, setUploadingPop] = useState(false);
  const [showSubSuccess, setShowSubSuccess] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  // Branding state
  const [branding, setBranding] = useState({
    appName: '',
    fontFamily: 'Inter',
    fontSize: '24px',
    fontColor: '#000000'
  });

  useEffect(() => {
    if (!user) return;
    
    // Fetch profile for branding
    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setProfile(data);
        if (data.branding) {
          setBranding(data.branding);
        }
      }
    });

    // Query payments associated with this tenant
    const q = query(collection(db, 'payments'), where('tenantId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsList = snapshot.docs.map(doc => ({
        paymentId: doc.id,
        ...doc.data()
      })) as Payment[];
      setPayments(paymentsList);
      setLoading(false);
    });

    // Query users who joined through this tenant's referral link
    const qUsers = query(collection(db, 'users'), where('tenantId', '==', user.uid));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      })) as TenantUser[];
      setTenantUsers(list);
    }, (err) => {
      console.warn("Could not load users for tenant", err);
    });

    return () => {
      unsubProfile();
      unsubscribe();
      unsubUsers();
    };
  }, [user]);

  const handleSubPayment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;

    setUploadingPop(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.7);

        try {
          const subId = `sub_${Date.now()}`;
          const { setDoc } = await import('../lib/firebase');
          
          await setDoc(doc(db, 'tenantSubscriptions', subId), {
            subId,
            tenantId: user.uid,
            tenantName: profile.displayName,
            proofImage: base64String,
            amount: 299.99,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          
          setShowSubSuccess(true);
          setTimeout(() => setShowSubSuccess(false), 8000);
        } catch (error: any) {
          console.error("Error submitting sub payment", error);
          setLastError(`Subscription Submission Failed: ${error.message} (Code: ${error.code}) - File: ${file.name} (${file.size} bytes)`);
          alert("Submission Failed. Please try again.");
        } finally {
          setUploadingPop(false);
        }
      };
      img.onerror = () => {
        setLastError(`Failed to process image file: ${file.name}`);
        setUploadingPop(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setLastError(`Failed to read file: ${file.name}`);
      setUploadingPop(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async () => {
    if (!user) return;
    setSavingBranding(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        branding,
        updatedAt: new Date().toISOString()
      });
      startPreview();
    } catch (error: any) {
      console.error("Error saving branding", error);
      setLastError(`Branding Save Failed: ${error.message} (Code: ${error.code})`);
    } finally {
      setSavingBranding(false);
    }
  };

  const startPreview = () => {
    setShowPreview(true);
    setTimeout(() => setShowPreview(false), 5000);
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      const paymentToApprove = payments.find(p => p.paymentId === paymentId);
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });

      if (paymentToApprove?.userId) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        try {
          await updateDoc(doc(db, 'users', paymentToApprove.userId), {
            tenantApproved: true,
            userSubscriptionActive: true,
            userSubscriptionExpiresAt: expiresAt.toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (uErr) {
          console.warn("User doc update skipped/fallback", uErr);
        }
      }

      setSelectedPayment(null);
    } catch (error: any) {
      console.error("Error approving payment", error);
      setLastError(`Payment Approval Failed: ${error.message} (Code: ${error.code})`);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setSelectedPayment(null);
    } catch (error: any) {
      console.error("Error rejecting payment", error);
      setLastError(`Payment Rejection Failed: ${error.message} (Code: ${error.code})`);
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalEarnings = payments.filter(p => p.status === 'approved').reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Merge users from tenantUsers collection and payment records
  const allReferredUsers: TenantUser[] = (() => {
    const userMap = new Map<string, TenantUser>();

    tenantUsers.forEach(u => {
      userMap.set(u.userId, { ...u });
    });

    payments.forEach(p => {
      if (!userMap.has(p.userId)) {
        userMap.set(p.userId, {
          userId: p.userId,
          displayName: p.userDisplayName || 'Community Member',
          role: 'seeker',
          photoURL: p.userPhotoURL,
          createdAt: p.createdAt,
          tenantId: user?.uid,
          tenantApproved: p.status === 'approved',
          userSubscriptionActive: p.status === 'approved',
        });
      }
    });

    return Array.from(userMap.values()).map(u => {
      const userPayments = payments.filter(p => p.userId === u.userId);
      const latestPayment = userPayments.length > 0 
        ? [...userPayments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : undefined;
      const hasApprovedPayment = userPayments.some(p => p.status === 'approved');
      const isApproved = Boolean(u.tenantApproved || u.userSubscriptionActive || hasApprovedPayment);

      return {
        ...u,
        latestPayment,
        isApproved,
      };
    });
  })();

  const activeApprovedUsers = allReferredUsers.filter(u => u.isApproved);
  const pendingUsers = allReferredUsers.filter(u => !u.isApproved);

  const displayedUsers = allReferredUsers.filter(u => {
    if (userFilter === 'active') return u.isApproved;
    if (userFilter === 'pending') return !u.isApproved;
    return true;
  }).filter(u => {
    if (!userSearchQuery.trim()) return true;
    return (u.displayName || '').toLowerCase().includes(userSearchQuery.toLowerCase());
  });

  const tenantInviteLink = typeof window !== 'undefined' && user?.uid
    ? `${window.location.origin}/?tenant=${user.uid}`
    : '';

  const handleCopyLink = () => {
    if (!tenantInviteLink) return;
    navigator.clipboard.writeText(tenantInviteLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(err => {
      console.warn("Clipboard copy failed", err);
    });
  };

  const handleShareLink = () => {
    if (!tenantInviteLink) return;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName || 'Tenant'} - TimeGig Portal`,
        text: `Join my network on TimeGig! Sign up through my link to access exclusive opportunities:`,
        url: tenantInviteLink
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleApproveUser = async (targetUserId: string) => {
    if (!user) return;
    setApprovingUserId(targetUserId);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      try {
        await updateDoc(doc(db, 'users', targetUserId), {
          tenantApproved: true,
          userSubscriptionActive: true,
          userSubscriptionExpiresAt: expiresAt.toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Direct user doc update skipped/fallback", err);
      }

      // Approve any pending payment from this user
      const userPendingPayments = payments.filter(p => p.userId === targetUserId && p.status === 'pending');
      for (const p of userPendingPayments) {
        await updateDoc(doc(db, 'payments', p.paymentId), {
          status: 'approved',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error("Error approving user", error);
      setLastError(`User Approval Failed: ${error.message}`);
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleToggleUserStatus = async (targetUserId: string, currentActive: boolean) => {
    if (!user) return;
    setApprovingUserId(targetUserId);
    try {
      await updateDoc(doc(db, 'users', targetUserId), {
        tenantApproved: !currentActive,
        userSubscriptionActive: !currentActive,
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error updating user status", error);
      setLastError(`Status Update Failed: ${error.message}`);
    } finally {
      setApprovingUserId(null);
    }
  };

  const renderUserCards = () => {
    if (displayedUsers.length === 0) {
      return (
        <div className="bg-white p-10 text-center rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-500">
            <Users className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              {userSearchQuery ? 'No matching users found' : 'No Users Joined Via Link Yet'}
            </h4>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              {userSearchQuery 
                ? 'Try a different search term or clear your filter.' 
                : 'Share your unique tenant link above. Users who join through your link will appear here and must pay you a monthly subscription to keep their account active.'}
            </p>
          </div>
          {!userSearchQuery && (
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Tenant Referral Link</span>
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedUsers.map(u => {
          const isProcessing = approvingUserId === u.userId;
          const joinedDateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';

          return (
            <div 
              key={u.userId}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              {/* User Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shrink-0 border border-blue-100">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-blue-900 uppercase">
                        {(u.displayName || 'U').charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-gray-900 truncate leading-snug">
                      {u.displayName || 'Anonymous Member'}
                    </h4>
                    <div className="flex items-center space-x-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 capitalize">{u.role || 'Member'}</span>
                      <span>•</span>
                      <span>Joined {joinedDateStr}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {u.isApproved ? (
                    <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Active & Approved</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Sub Payment Due</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Monthly Subscription Details Box */}
              <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2 text-[11px]">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Monthly Subscription</span>
                  <span className="text-gray-900 font-black">R 99.00 / month</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Account Status</span>
                  <span className={`font-bold ${u.isApproved ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {u.isApproved ? 'Active (Approved by Tenant)' : 'Payment / Approval Required'}
                  </span>
                </div>
                {u.latestPayment && (
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px]">
                    <span className="text-gray-500">Latest PoP: R {u.latestPayment.amount?.toFixed(2) || '99.00'}</span>
                    <span className={`font-black uppercase tracking-wider ${
                      u.latestPayment.status === 'approved' ? 'text-emerald-600' : 
                      u.latestPayment.status === 'rejected' ? 'text-red-500' : 'text-amber-600'
                    }`}>
                      {u.latestPayment.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 pt-1">
                {u.latestPayment && (
                  <button
                    onClick={() => setSelectedPayment(u.latestPayment!)}
                    className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View PoP</span>
                  </button>
                )}

                {!u.isApproved ? (
                  <button
                    onClick={() => handleApproveUser(u.userId)}
                    disabled={isProcessing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1.5 transition-all shadow-sm shadow-emerald-200 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Approve User & Activate</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggleUserStatus(u.userId, true)}
                    disabled={isProcessing}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5 text-gray-400" />
                        <span>Pause Access</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Menu Bar */}
      <div className="bg-blue-900 text-white p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-widest">Tenant Portal</h1>
            <p className="text-[8px] text-blue-300 font-bold uppercase tracking-widest">Service Management</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => {
              if (profile?.subscriptionActive) setActiveTab('overview');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${!profile?.subscriptionActive && activeTab !== 'overview' ? 'opacity-50' : ''}`}
          >
            {!profile?.subscriptionActive && <Lock className="w-3 h-3 mr-1" />}
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
          <button 
            onClick={() => {
              if (profile?.subscriptionActive) setActiveTab('users');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${!profile?.subscriptionActive && activeTab !== 'users' ? 'opacity-50' : ''}`}
          >
            {!profile?.subscriptionActive && <Lock className="w-3 h-3 mr-1" />}
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Users</span>
            {activeApprovedUsers.length > 0 && (
              <span className="bg-emerald-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">{activeApprovedUsers.length}</span>
            )}
          </button>
          <button 
            onClick={() => {
              if (profile?.subscriptionActive) setActiveTab('pop');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pop' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${!profile?.subscriptionActive && activeTab !== 'pop' ? 'opacity-50' : ''}`}
          >
            {!profile?.subscriptionActive && <Lock className="w-3 h-3 mr-1" />}
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PoP</span>
            {pendingPayments.length > 0 && (
              <span className="bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">{pendingPayments.length}</span>
            )}
          </button>
          <button 
            onClick={() => {
              if (profile?.subscriptionActive) setActiveTab('branding');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'branding' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${!profile?.subscriptionActive && activeTab !== 'branding' ? 'opacity-50' : ''}`}
          >
            {!profile?.subscriptionActive && <Lock className="w-3 h-3 mr-1" />}
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Branding</span>
          </button>
          <button 
            onClick={() => setActiveTab('subscription')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'subscription' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'}`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sub Fee</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          {lastError && (
            <div className="mb-6 bg-red-50 border-2 border-red-100 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-red-600">
                  <X className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">System Error Detected</span>
                </div>
                <button 
                  onClick={() => setLastError(null)}
                  className="text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-600"
                >
                  Clear Logs
                </button>
              </div>
              <div className="bg-white/50 p-4 rounded-xl border border-red-50">
                <p className="text-[10px] font-mono font-bold text-red-600 break-all leading-relaxed">
                  {lastError}
                </p>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <DollarSign className="w-5 h-5 text-green-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Earnings</p>
                    <p className="text-2xl font-black text-gray-900">R {totalEarnings.toFixed(2)}</p>
                  </div>
                  
                  <div 
                    onClick={() => setActiveTab('users')}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <UserCheck className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {activeApprovedUsers.length} Active
                      </span>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Approved Users</p>
                    <p className="text-2xl font-black text-gray-900">
                      {activeApprovedUsers.length} <span className="text-xs text-gray-400 font-bold">/ {allReferredUsers.length} joined</span>
                    </p>
                  </div>

                  <div 
                    onClick={() => setActiveTab('pop')}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 transition-all group"
                  >
                    <ShieldCheck className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending PoP Approvals</p>
                    <p className="text-2xl font-black text-gray-900">{pendingPayments.length}</p>
                  </div>
                </div>

                {/* Tenant Referral / Join Link Card */}
                <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                        <LinkIcon className="w-5 h-5 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider">Your Tenant Referral & Join Link</h3>
                        <p className="text-[10px] text-blue-200 font-medium">Invite users to register directly through your tenant network</p>
                      </div>
                    </div>
                    <span className="self-start sm:self-auto text-[9px] font-black bg-blue-500/30 text-blue-200 px-2.5 py-1 rounded-full uppercase tracking-widest border border-blue-400/30">
                      Active Tenant Link
                    </span>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-2.5 flex items-center space-x-2 border border-white/10">
                    <input 
                      type="text" 
                      readOnly 
                      value={tenantInviteLink} 
                      className="bg-transparent text-white text-xs font-mono font-medium flex-1 px-2 focus:outline-none truncate"
                    />
                    <button 
                      onClick={handleCopyLink}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 transition-all shadow-sm ${
                        copiedLink 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white text-blue-900 hover:bg-blue-50'
                      }`}
                    >
                      {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button 
                      onClick={handleShareLink}
                      className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-blue-200/90 leading-relaxed font-medium">
                    Users who join through your tenant link are tracked in your portal. <span className="text-white font-bold underline decoration-blue-400">Users must pay you a monthly subscription to keep their account active.</span>
                  </p>
                </div>

                {/* Monthly Subscription Policy Notice */}
                <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Monthly Subscription Requirement Policy</h4>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Users who join through your tenant link are required to pay you a monthly subscription (R99,00/month) to keep their account active. As tenant administrator, you verify their subscription payment and approve or pause their account access.
                  </p>
                </div>

                {/* Active Approved Users Section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Active Approved Users</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        {activeApprovedUsers.length} Active & Approved • {allReferredUsers.length} Total Registered
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search users..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
                        />
                      </div>
                      
                      <div className="flex items-center bg-gray-200/70 p-1 rounded-xl text-[9px] font-black uppercase tracking-wider">
                        <button
                          onClick={() => setUserFilter('all')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${userFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                        >
                          All ({allReferredUsers.length})
                        </button>
                        <button
                          onClick={() => setUserFilter('active')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${userFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}
                        >
                          Active ({activeApprovedUsers.length})
                        </button>
                        <button
                          onClick={() => setUserFilter('pending')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${userFilter === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500'}`}
                        >
                          Due ({pendingUsers.length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {renderUserCards()}
                </div>

                {/* Recent Payments Box */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                   <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Recent Payments</h3>
                   {payments.length === 0 ? (
                     <p className="text-center py-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">No payment records yet</p>
                   ) : (
                     <div className="space-y-4">
                       {payments.slice(0, 5).map(p => (
                         <div key={p.paymentId} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
                                {p.userPhotoURL && <img src={p.userPhotoURL} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-gray-900">{p.userDisplayName}</p>
                                <span className={`text-[8px] font-black uppercase tracking-widest ${p.status === 'approved' ? 'text-green-600' : p.status === 'rejected' ? 'text-red-600' : 'text-orange-600'}`}>
                                  {p.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs font-black text-gray-900">R {p.amount?.toFixed(2) || '0.00'}</p>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header Info Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Active Approved Users Directory</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      Manage community members who joined through your tenant link
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-200/50">
                      {activeApprovedUsers.length} Active Approved
                    </span>
                    <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200/50">
                      {pendingUsers.length} Payment Due
                    </span>
                  </div>
                </div>

                {/* Tenant Referral / Join Link Card */}
                <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                        <LinkIcon className="w-5 h-5 text-blue-300" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider">Share Your Tenant Link</h4>
                        <p className="text-[10px] text-blue-200 font-medium">New members who use this link are assigned directly to your tenant portal</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-2.5 flex items-center space-x-2 border border-white/10">
                    <input 
                      type="text" 
                      readOnly 
                      value={tenantInviteLink} 
                      className="bg-transparent text-white text-xs font-mono font-medium flex-1 px-2 focus:outline-none truncate"
                    />
                    <button 
                      onClick={handleCopyLink}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 transition-all shadow-sm ${
                        copiedLink 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white text-blue-900 hover:bg-blue-50'
                      }`}
                    >
                      {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <button 
                      onClick={handleShareLink}
                      className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>

                {/* Monthly Subscription Policy Notice */}
                <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 space-y-2">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Subscription Policy Reminder</h4>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Users who joined through your tenant link must pay you a monthly subscription to keep their account active. Active approved users have full access to services. If a user has not paid their monthly subscription fee, click Pause Access or request payment.
                  </p>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users by name..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-2xl text-[9px] font-black uppercase tracking-wider">
                    <button
                      onClick={() => setUserFilter('all')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${userFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      All ({allReferredUsers.length})
                    </button>
                    <button
                      onClick={() => setUserFilter('active')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${userFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      Active ({activeApprovedUsers.length})
                    </button>
                    <button
                      onClick={() => setUserFilter('pending')}
                      className={`px-3 py-1.5 rounded-xl transition-all ${userFilter === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                      Payment Due ({pendingUsers.length})
                    </button>
                  </div>
                </div>

                {/* Users Cards Grid */}
                {renderUserCards()}
              </motion.div>
            )}

            {activeTab === 'pop' && (
              <motion.div 
                key="pop"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Proof of Payment Requests</h3>
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded font-black uppercase tracking-widest">{pendingPayments.length} Pending</span>
                </div>

                {pendingPayments.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm space-y-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No pending payment verifications</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingPayments.map(p => (
                      <div key={p.paymentId} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-blue-50 rounded-2xl overflow-hidden shadow-sm">
                                {p.userPhotoURL ? (
                                  <img src={p.userPhotoURL} alt={p.userDisplayName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Users className="w-6 h-6 text-blue-200" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-gray-900">{p.userDisplayName}</h4>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Payment Verification</p>
                              </div>
                           </div>
                        </div>

                        <div 
                          onClick={() => setSelectedPayment(p)}
                          className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2 cursor-pointer hover:bg-gray-100 transition-colors"
                        >
                           <div className="flex items-center space-x-2">
                             <FileText className="w-4 h-4 text-gray-400" />
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Click to View Proof</span>
                           </div>
                           <div className="h-40 w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
                              <img src={p.proofImage} alt="Payment Proof" className="w-full h-full object-contain" />
                           </div>
                        </div>

                        <div className="flex space-x-2 pt-2">
                          <button 
                            onClick={() => handleApprovePayment(p.paymentId)}
                            className="flex-1 bg-green-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg shadow-green-100 hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button 
                            onClick={() => handleRejectPayment(p.paymentId)}
                            className="flex-1 bg-gray-100 text-gray-400 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'branding' && (
              <motion.div 
                key="branding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">White-Label Branding</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Customize your application's appearance</p>
                    </div>
                    <button 
                      onClick={startPreview}
                      className="flex items-center space-x-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview (5s)</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">App Name</label>
                      <input 
                        type="text"
                        value={branding.appName}
                        onChange={(e) => setBranding({...branding, appName: e.target.value})}
                        placeholder="e.g. My Gigs App"
                        className="w-full bg-gray-50 border-none rounded-xl py-4 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Font Family</label>
                      <select 
                        value={branding.fontFamily}
                        onChange={(e) => setBranding({...branding, fontFamily: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-xl py-4 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100 appearance-none"
                      >
                        <option value="Inter">Inter (Sans)</option>
                        <option value="Playfair Display">Playfair Display (Serif)</option>
                        <option value="Space Grotesk">Space Grotesk (Modern)</option>
                        <option value="JetBrains Mono">JetBrains Mono (Monospace)</option>
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Font Size</label>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="range"
                          min="16"
                          max="72"
                          value={parseInt(branding.fontSize)}
                          onChange={(e) => setBranding({...branding, fontSize: `${e.target.value}px`})}
                          className="flex-1 accent-blue-600"
                        />
                        <span className="text-xs font-black text-gray-900 w-12 text-center">{branding.fontSize}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Branding Color</label>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="color"
                          value={branding.fontColor}
                          onChange={(e) => setBranding({...branding, fontColor: e.target.value})}
                          className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                        />
                        <input 
                          type="text"
                          value={branding.fontColor}
                          onChange={(e) => setBranding({...branding, fontColor: e.target.value})}
                          className="flex-1 bg-gray-50 border-none rounded-xl py-4 px-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveBranding}
                    disabled={savingBranding}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {savingBranding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
            {activeTab === 'subscription' && (
              <motion.div 
                key="subscription"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Monthly Subscription</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Keep your application active for 30 days</p>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${profile?.subscriptionActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {profile?.subscriptionActive ? 'Status: Active' : 'Status: Payment Required'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* 3D Realistic Bank Card */}
                    <div className="relative w-full aspect-[1.6/1] rounded-3xl p-6 md:p-8 text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] overflow-hidden group transform perspective-[1000px] hover:rotate-x-3 hover:rotate-y-3 transition-transform duration-500 bg-gradient-to-tr from-slate-950 via-indigo-950 to-blue-950 border border-white/15">
                      {/* Holographic foil shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-60 pointer-events-none transform -skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000" />
                      
                      {/* Background ambient lighting */}
                      <div className="absolute -top-20 -right-20 w-48 h-48 bg-blue-500/30 rounded-full blur-2xl" />
                      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-teal-500/20 rounded-full blur-2xl" />

                      <div className="relative h-full flex flex-col justify-between z-10">
                        {/* Top Row: Bank name, Contactless symbol, EMV Chip */}
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-3">
                            {/* Realistic EMV Gold Chip with 3D embossed look */}
                            <div className="w-11 h-8 bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 rounded-md shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_2px_4px_rgba(0,0,0,0.3)] border border-amber-300/50 flex flex-col justify-between p-1">
                              <div className="w-full h-px bg-amber-800/30" />
                              <div className="w-full h-px bg-amber-800/30" />
                              <div className="w-full h-px bg-amber-800/30" />
                            </div>
                            {/* Contactless symbol */}
                            <div className="text-white/60">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 010-7.778M12 20a9 9 0 000-16m3.889 15.614a11 11 0 000-15.556" />
                              </svg>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 drop-shadow">Capitec Bank</p>
                            <span className="text-sm font-black italic tracking-wider bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent drop-shadow">VISA</span>
                          </div>
                        </div>

                        {/* Middle Row: Account Number */}
                        <div className="space-y-1">
                          <div className="text-[7px] font-black uppercase tracking-widest text-white/40">Capitec Account Number</div>
                          <p className="text-xl md:text-2xl font-mono tracking-[0.18em] font-black text-white/95 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] filter">
                            1334 0673 66
                          </p>
                        </div>

                        {/* Bottom Row: Reference Code */}
                        <div className="flex justify-between items-end pt-2 border-t border-white/10">
                          <div className="space-y-0.5">
                            <p className="text-[6px] font-black uppercase tracking-widest text-white/50">Payment Reference</p>
                            <p className="text-xs font-black font-mono text-cyan-300 tracking-widest bg-white/10 px-2.5 py-1 rounded border border-white/10 shadow-inner">
                              Sub30
                            </p>
                          </div>

                          <div className="space-y-0.5 text-right">
                            <p className="text-[6px] font-black uppercase tracking-widest text-white/50">Account Holder</p>
                            <p className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow">Matthews</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monthly Fee</span>
                          <span className="text-lg font-black text-gray-900">R 299,99</span>
                        </div>
                        <div className="h-px bg-gray-200" />
                        <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase tracking-wider">
                          Please perform a bank transfer to the account details shown on the left. Ensure you use the correct reference <span className="text-blue-600 font-black">Sub30</span> for automatic processing.
                        </p>
                      </div>

                      <div className="space-y-3">
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upload Proof of Payment</p>
                         <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-gray-50 transition-all group relative overflow-hidden">
                            {uploadingPop ? (
                              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-6 h-6 text-gray-300 group-hover:text-blue-500 transition-colors mb-2" />
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Select Document</span>
                              </>
                            )}
                            <input type="file" className="hidden" accept="image/*" onChange={handleSubPayment} disabled={uploadingPop} />
                         </label>
                      </div>

                      <AnimatePresence>
                        {showSubSuccess && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-green-50 text-green-700 p-6 rounded-3xl border-2 border-green-100 flex flex-col items-center text-center space-y-3 shadow-xl shadow-green-100"
                          >
                             <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
                               <Check className="w-6 h-6" />
                             </div>
                             <div className="space-y-1">
                               <h4 className="text-sm font-black uppercase tracking-tighter text-green-800">Congratulations!</h4>
                               <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Payment Submitted Successfully</p>
                             </div>
                             <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 leading-relaxed">
                               Well done! Your proof of payment has been delivered to the Admin. Verification usually takes 15-25 minutes.
                             </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Splash Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-white flex flex-col items-center justify-center p-12 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-8"
            >
              <h2 
                style={{ 
                  fontFamily: branding.fontFamily,
                  fontSize: branding.fontSize,
                  color: branding.fontColor
                }}
                className="font-black leading-tight"
              >
                {branding.appName || 'Your App Name'}
              </h2>
              <div className="w-12 h-1 bg-blue-600 mx-auto rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Welcome to your personalized experience</p>
            </motion.div>
            
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center space-x-2">
              <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: "linear" }}
                  className="h-full bg-blue-600"
                />
              </div>
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Preview ends in 5s</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen View Modal */}
      <AnimatePresence>
        {selectedPayment && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] bg-black/95 flex flex-col p-6"
          >
            <div className="flex items-center justify-between text-white mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                  {selectedPayment.userPhotoURL && <img src={selectedPayment.userPhotoURL} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{selectedPayment.userDisplayName}</h3>
                  <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Payment Proof Document</p>
                </div>
              </div>
              <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <img 
                src={selectedPayment.proofImage} 
                alt="Full Proof" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <button 
                onClick={() => handleApprovePayment(selectedPayment.paymentId)}
                className="bg-green-600 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-green-900/40"
              >
                Approve Payment
              </button>
              <button 
                onClick={() => handleRejectPayment(selectedPayment.paymentId)}
                className="bg-white/10 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
              >
                Reject Payment
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
