import { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, updateDoc, doc, where, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Users, ShieldCheck, DollarSign, ArrowLeft, Check, X, FileText, Loader2, 
  TrendingUp, Search, Palette, Eye, CreditCard, Upload, Lock, Copy, CheckCircle2, 
  Share2, Link as LinkIcon, UserCheck, Calendar, Clock, AlertCircle, RefreshCw,
  ExternalLink, UserX, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { calculateAdminFee } from '../lib/utils';

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
  initialTab?: 'overview' | 'users' | 'pop' | 'subscription';
}

export default function TenantPortalView({ onClose, initialTab = 'overview' }: TenantPortalViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pop' | 'subscription' | 'businesses'>(initialTab);
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

  // Businesses States
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizOwner, setNewBizOwner] = useState('');
  const [newBizEmail, setNewBizEmail] = useState('');
  const [newBizDocName, setNewBizDocName] = useState('CIPC Registration Certificate');
  const [newBizDesc, setNewBizDesc] = useState('');
  const [newBizImage, setNewBizImage] = useState<string | null>(null);
  const [addingBiz, setAddingBiz] = useState(false);

  const activeReferrals = tenantUsers.filter(u => u.userSubscriptionActive).length;
  const adminSubscriptionFee = calculateAdminFee(activeReferrals);

  // Tenant's own monthly subscription fee configuration
  const tenantFee = profile?.monthlySubscriptionFee !== undefined ? Number(profile.monthlySubscriptionFee) : 99.00;
  const [customFeeInput, setCustomFeeInput] = useState<string>('99.00');
  const [savingFee, setSavingFee] = useState(false);
  const [feeSavedToast, setFeeSavedToast] = useState<string | null>(null);

  // Bank Details State
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    accountType: 'Savings',
    branchCode: ''
  });
  const [savingBankDetails, setSavingBankDetails] = useState(false);

  useEffect(() => {
    if (profile?.monthlySubscriptionFee !== undefined) {
      setCustomFeeInput(String(profile.monthlySubscriptionFee));
    }
    if (profile?.bankDetails) {
      setBankDetails(profile.bankDetails);
    }
  }, [profile?.monthlySubscriptionFee, profile?.bankDetails]);

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (profile?.isTenantDisabled) {
      setLastError("Action blocked: Your tenant account is disabled.");
      return;
    }
    setSavingBankDetails(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bankDetails,
        updatedAt: new Date().toISOString()
      });
      setFeeSavedToast("Bank details successfully updated.");
      setTimeout(() => setFeeSavedToast(null), 3000);
    } catch (err: any) {
      console.error("Error saving bank details", err);
      setLastError(`Failed to update bank details: ${err.message}`);
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handleSaveMonthlyFee = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    if (profile?.isTenantDisabled) {
      setLastError("Cannot update fee: Your tenant account has been disabled by platform administration.");
      return;
    }
    const parsed = parseFloat(customFeeInput);
    if (isNaN(parsed) || parsed <= 0) {
      setLastError("Please enter a valid monthly subscription fee (greater than R 0.00).");
      return;
    }
    setSavingFee(true);
    try {
      const feeToSave = Math.round(parsed * 100) / 100;
      await updateDoc(doc(db, 'users', user.uid), {
        monthlySubscriptionFee: feeToSave,
        updatedAt: new Date().toISOString()
      });
      setFeeSavedToast(`Monthly fee successfully updated to R ${feeToSave.toFixed(2)} / month. All your referred users will pay this amount.`);
      setTimeout(() => setFeeSavedToast(null), 4000);
    } catch (err: any) {
      console.error("Error saving monthly fee", err);
      setLastError(`Failed to update subscription fee: ${err.message}`);
    } finally {
      setSavingFee(false);
    }
  };

  // Branding state
  // Branding state removed

  useEffect(() => {
    if (!user) return;
    
    // Fetch profile for branding
    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setProfile(data);
      }
    }, (err) => {
      console.warn("Could not load profile in tenant portal", err);
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
    }, (err) => {
      console.warn("Could not load payments in tenant portal", err);
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

    // Query businesses under this tenant
    const qBusinesses = query(collection(db, 'businesses'), where('tenantId', '==', user.uid));
    const unsubBusinesses = onSnapshot(qBusinesses, (snapshot) => {
       const list = snapshot.docs.map(doc => ({
         businessId: doc.id,
         ...doc.data()
       }));
       setBusinesses(list);
    }, (err) => {
       console.warn("Could not load businesses in tenant portal", err);
       handleFirestoreError(err, OperationType.LIST, 'businesses');
    });

    return () => {
      unsubProfile();
      unsubscribe();
      unsubUsers();
      unsubBusinesses();
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
            amount: adminSubscriptionFee,
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
    if (profile?.isTenantDisabled) {
      setLastError("Tenant link unavailable: Your tenant account has been disabled by platform administration.");
      return;
    }
    if (!tenantInviteLink) return;
    navigator.clipboard.writeText(tenantInviteLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(err => {
      console.warn("Clipboard copy failed", err);
    });
  };

  const handleShareLink = () => {
    if (profile?.isTenantDisabled) {
      setLastError("Tenant link unavailable: Your tenant account has been disabled by platform administration.");
      return;
    }
    if (!tenantInviteLink) return;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName || 'Tenant'} - TimeGig Portal`,
        text: `Join my network on TimeGig! Monthly subscription fee is R ${tenantFee.toFixed(2)}/month. Sign up here:`,
        url: tenantInviteLink
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleApproveUser = async (targetUserId: string) => {
    if (!user) return;
    if (profile?.isTenantDisabled) {
      setLastError("Action blocked: Your tenant account has been disabled by platform administration.");
      return;
    }
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
    if (profile?.isTenantDisabled) {
      setLastError("Action blocked: Your tenant account has been disabled by platform administration.");
      return;
    }
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

  const handleApproveBusiness = async (businessId: string) => {
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      setSelectedBusiness(null);
    } catch (err: any) {
      console.error("Error approving business", err);
      setLastError(`Business Approval Failed: ${err.message}`);
    }
  };

  const handleRejectBusiness = async (businessId: string) => {
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setSelectedBusiness(null);
    } catch (err: any) {
      console.error("Error rejecting business", err);
      setLastError(`Business Rejection Failed: ${err.message}`);
    }
  };

  const handleAddBusinessDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBizName.trim()) return;

    setAddingBiz(true);
    try {
      const { setDoc } = await import('../lib/firebase');
      const businessId = `biz_${Date.now()}`;
      
      await setDoc(doc(db, 'businesses', businessId), {
        businessId,
        tenantId: user.uid,
        ownerId: user.uid,
        ownerName: profile?.displayName || 'Tenant (Self)',
        name: newBizName,
        email: newBizEmail,
        description: newBizDesc,
        documentName: newBizDocName,
        proofImage: newBizImage || '',
        status: 'approved',
        location: profile?.location || null,
        createdAt: new Date().toISOString()
      });

      setNewBizName('');
      setNewBizOwner('');
      setNewBizEmail('');
      setNewBizDesc('');
      setNewBizImage(null);
      setShowAddBusinessModal(false);
    } catch (err: any) {
      console.error("Error adding business directly", err);
      setLastError(`Add Business Failed: ${err.message}`);
    } finally {
      setAddingBiz(false);
    }
  };

  const handleBizImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
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
        setNewBizImage(base64String);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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
                  <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Member Subscription Fee</span>
                  <span className="text-gray-900 font-black">R {tenantFee.toFixed(2)} / month</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Approval Authority</span>
                  <span className="text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                    Tenant (You)
                  </span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Account Status</span>
                  <span className={`font-bold ${u.isApproved ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {u.isApproved ? 'Active (Approved by Tenant)' : 'Payment / Approval Required'}
                  </span>
                </div>
                {u.latestPayment && (
                  <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[10px]">
                    <span className="text-gray-500">Latest PoP: R {u.latestPayment.amount?.toFixed(2) || tenantFee.toFixed(2)}</span>
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
              if (profile?.subscriptionActive && !profile?.isTenantDisabled) setActiveTab('overview');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${(!profile?.subscriptionActive || profile?.isTenantDisabled) && activeTab !== 'overview' ? 'opacity-50' : ''}`}
          >
            {(!profile?.subscriptionActive || profile?.isTenantDisabled) && <Lock className="w-3 h-3 mr-1" />}
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
          <button 
            onClick={() => {
              if (profile?.subscriptionActive && !profile?.isTenantDisabled) setActiveTab('users');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${(!profile?.subscriptionActive || profile?.isTenantDisabled) && activeTab !== 'users' ? 'opacity-50' : ''}`}
          >
            {(!profile?.subscriptionActive || profile?.isTenantDisabled) && <Lock className="w-3 h-3 mr-1" />}
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Users</span>
            {activeApprovedUsers.length > 0 && (
              <span className="bg-emerald-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">{activeApprovedUsers.length}</span>
            )}
          </button>
          <button 
            onClick={() => {
              if (profile?.subscriptionActive && !profile?.isTenantDisabled) setActiveTab('pop');
              else setActiveTab('subscription');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pop' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'} ${(!profile?.subscriptionActive || profile?.isTenantDisabled) && activeTab !== 'pop' ? 'opacity-50' : ''}`}
          >
            {(!profile?.subscriptionActive || profile?.isTenantDisabled) && <Lock className="w-3 h-3 mr-1" />}
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PoP</span>
            {pendingPayments.length > 0 && (
              <span className="bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">{pendingPayments.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('subscription')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'subscription' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'}`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sub Fee</span>
          </button>
          <button 
            onClick={() => setActiveTab('businesses')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'businesses' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Businesses</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          {feeSavedToast && (
            <div className="mb-6 bg-emerald-600 text-white py-3.5 px-5 rounded-2xl flex items-center space-x-3 text-xs font-bold shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feeSavedToast}</span>
            </div>
          )}

          {profile?.isTenantDisabled && (
            <div className="mb-6 bg-red-600 text-white rounded-3xl p-6 shadow-xl space-y-2 border-2 border-red-500 animate-in fade-in">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-5 h-5 text-white shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-widest">Tenant Account Disabled by Admin</h3>
              </div>
              <p className="text-[11px] text-red-100 font-medium leading-relaxed">
                Your tenant account has been disabled immediately by platform administration. Your referral link onboarding, user approval actions, and portal features are currently suspended. Please contact platform administration at <span className="font-bold underline text-white">timegig2026@gmail.com</span>.
              </p>
            </div>
          )}

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
                {/* 4 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Platform Capacity</p>
                    <p className="text-2xl font-black text-gray-900">1,000 <span className="text-xs text-gray-400 font-bold">Spots</span></p>
                  </div>

                  <div 
                    onClick={() => setActiveTab('pop')}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 transition-all group"
                  >
                    <ShieldCheck className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending PoP Approvals</p>
                    <p className="text-2xl font-black text-gray-900">{pendingPayments.length}</p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <CreditCard className="w-5 h-5 text-indigo-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Your Member Fee</p>
                    <p className="text-2xl font-black text-gray-900">R {tenantFee.toFixed(2)} <span className="text-xs text-gray-400 font-bold">/mo</span></p>
                  </div>
                </div>

                {/* Tenant Custom Monthly Subscription Fee Settings */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                          Set Your Monthly Member Subscription Fee
                        </h3>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Tenants configure their own monthly fee. All users who register through your link will pay this subscription amount directly to you.
                      </p>
                    </div>

                    <div className="bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-xl text-xs font-black border border-emerald-200/60 self-start sm:self-auto shrink-0">
                      Current: R {tenantFee.toFixed(2)} / month
                    </div>
                  </div>

                  <form onSubmit={handleSaveMonthlyFee} className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                    <div className="relative flex-1 w-full">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">R</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="50000"
                        value={customFeeInput}
                        onChange={(e) => setCustomFeeInput(e.target.value)}
                        disabled={savingFee || profile?.isTenantDisabled}
                        placeholder="e.g. 99.00, 149.00, 250.00"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingFee || profile?.isTenantDisabled}
                      className="w-full sm:w-auto bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shrink-0 shadow-sm"
                    >
                      {savingFee ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Save Subscription Fee</span>
                      )}
                    </button>
                  </form>
                </div>

                {/* Tenant Banking Details Settings */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                        Your Banking Details for Member Payments
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Enter the bank account where you want your referred members to pay their monthly fees.
                    </p>
                  </div>

                  <form onSubmit={handleSaveBankDetails} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankDetails.bankName}
                        onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                        disabled={savingBankDetails || profile?.isTenantDisabled}
                        placeholder="e.g. Capitec, FNB, Standard Bank"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Holder</label>
                      <input
                        type="text"
                        value={bankDetails.accountHolder}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountHolder: e.target.value })}
                        disabled={savingBankDetails || profile?.isTenantDisabled}
                        placeholder="Full Name / Business Name"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Number</label>
                      <input
                        type="text"
                        value={bankDetails.accountNumber}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                        disabled={savingBankDetails || profile?.isTenantDisabled}
                        placeholder="Bank Account Number"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Type</label>
                      <select
                        value={bankDetails.accountType}
                        onChange={(e) => setBankDetails({ ...bankDetails, accountType: e.target.value })}
                        disabled={savingBankDetails || profile?.isTenantDisabled}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Savings">Savings</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Current">Current</option>
                        <option value="Business">Business</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Branch Code (Optional)</label>
                      <input
                        type="text"
                        value={bankDetails.branchCode}
                        onChange={(e) => setBankDetails({ ...bankDetails, branchCode: e.target.value })}
                        disabled={savingBankDetails || profile?.isTenantDisabled}
                        placeholder="e.g. 470010"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2 pt-2">
                      <button
                        type="submit"
                        disabled={savingBankDetails || profile?.isTenantDisabled}
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-sm"
                      >
                        {savingBankDetails ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Save Bank Details</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
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
                <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-5 space-y-2.5">
                  <div className="flex items-center space-x-2 text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Tenant Approval & Member Subscription Policy</h4>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                    Users who join through your tenant link are required to pay your monthly subscription fee of <span className="font-black text-amber-950">R {tenantFee.toFixed(2)} / month</span> to keep their account active.
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium border-t border-amber-200/60 pt-2">
                    <strong className="text-amber-950 uppercase tracking-wider text-[10px]">Tenant Sole Approval Authority:</strong> You approve your own users who joined through your link, not platform admin. Review PoP submissions in the PoP tab or directly in the Users directory to activate or pause member access.
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-wider">Tenant Approval & Member Subscription Policy</h4>
                    </div>
                    <span className="text-[10px] font-black bg-amber-200/60 text-amber-950 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Fee: R {tenantFee.toFixed(2)}/mo
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                    Users who joined through your link must pay your monthly subscription fee of <span className="font-bold">R {tenantFee.toFixed(2)} / month</span>.
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium border-t border-amber-200/60 pt-2">
                    <strong className="text-amber-950 uppercase tracking-wider text-[10px]">Tenant Sole Approval Authority:</strong> Tenant must approve his own users who joined through his link, not admin. When a user submits Proof of Payment, click "Approve User & Activate" below to grant full service access.
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
                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${profile?.subscriptionActive ? 'bg-green-50 text-green-600' : (profile?.trialExpiresAt && new Date(profile.trialExpiresAt) > new Date()) ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                      {profile?.subscriptionActive ? 'Status: Active' : (profile?.trialExpiresAt && new Date(profile.trialExpiresAt) > new Date()) ? `Status: Trial (${Math.max(0, Math.ceil((new Date(profile.trialExpiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} days left)` : 'Status: Payment Required'}
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
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monthly Fee</span>
                            <p className="text-[9px] text-blue-600 font-bold uppercase tracking-tighter">
                              Based on {activeReferrals} active referrals
                            </p>
                          </div>
                          <span className="text-lg font-black text-gray-900">R {adminSubscriptionFee.toFixed(2)}</span>
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
            {activeTab === 'businesses' && (
              <motion.div 
                key="businesses"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Header & Direct Addition Trigger */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm animate-in fade-in">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Business Registrations</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Manage business documents, approvals, and onboarding</p>
                  </div>
                  <button
                    onClick={() => setShowAddBusinessModal(true)}
                    className="inline-flex items-center justify-center space-x-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shrink-0"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Add Business Directly</span>
                  </button>
                </div>

                {/* Businesses Cards / Grid */}
                {businesses.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">No Businesses Registered Yet</h4>
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                        Referred members who upload company certificates or registration documents for your approval will appear here. You can also manually add businesses yourself using the button above.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {businesses.map((biz) => {
                      const joinedDateStr = biz.createdAt ? new Date(biz.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently';
                      return (
                        <div 
                          key={biz.businessId}
                          className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                          {/* Business Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                                <Building2 className="w-6 h-6 text-indigo-600" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-gray-900 truncate leading-snug">
                                  {biz.name}
                                </h4>
                                <div className="flex items-center space-x-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                  <span>Owner: {biz.ownerName || 'Self'}</span>
                                  <span>•</span>
                                  <span>Submitted {joinedDateStr}</span>
                                </div>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="shrink-0">
                              <span className={`inline-flex items-center space-x-1 border px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                biz.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' :
                                biz.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200/60' :
                                'bg-amber-50 text-amber-700 border-amber-200/60'
                              }`}>
                                {biz.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                {biz.status === 'rejected' && <X className="w-3 h-3 text-red-500" />}
                                {biz.status === 'pending' && <Clock className="w-3 h-3 text-amber-600" />}
                                <span>{biz.status}</span>
                              </span>
                            </div>
                          </div>

                          {/* Info Box */}
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2 text-[11px]">
                            {biz.email && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Contact Email</span>
                                <span className="text-gray-900 font-mono font-bold">{biz.email}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Document Name</span>
                              <span className="text-indigo-900 font-black">{biz.documentName || 'Supporting Document'}</span>
                            </div>
                            {biz.description && (
                              <div className="pt-2 border-t border-gray-200/60 text-[11px] text-gray-600 font-medium leading-relaxed">
                                {biz.description}
                              </div>
                            )}
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center gap-2 pt-1">
                            {biz.proofImage ? (
                              <button
                                onClick={() => setSelectedBusiness(biz)}
                                className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Document</span>
                              </button>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg">
                                No Document Attachment
                              </span>
                            )}

                            {biz.status === 'pending' && (
                              <div className="flex-1 flex gap-2">
                                <button
                                  onClick={() => handleRejectBusiness(biz.businessId)}
                                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                                <button
                                  onClick={() => handleApproveBusiness(biz.businessId)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1 transition-all shadow-sm shadow-emerald-100"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                className="font-black leading-tight text-5xl"
              >
                GiGs
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

      {/* Full Screen Business Document View Modal */}
      <AnimatePresence>
        {selectedBusiness && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] bg-black/95 flex flex-col p-6"
          >
            <div className="flex items-center justify-between text-white shrink-0 mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-900/60 flex items-center justify-center shrink-0 border border-white/20">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{selectedBusiness.name}</h3>
                  <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Compliance Review Dashboard</p>
                </div>
              </div>
              <button onClick={() => setSelectedBusiness(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Multi-Panel Compliance Details View */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 text-white max-w-7xl mx-auto w-full pb-6">
              {/* Left Column: Uploaded Documents */}
              <div className="space-y-6 flex flex-col">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">Uploaded Files & Credentials</span>
                
                {/* Logo Picture */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-wider block">Business Profile Logo</span>
                  {selectedBusiness.proofImage ? (
                    <div className="h-44 flex items-center justify-center bg-slate-900/80 rounded-xl overflow-hidden p-2">
                      <img 
                        src={selectedBusiness.proofImage} 
                        alt="Profile Logo" 
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-44 flex items-center justify-center bg-slate-900/50 rounded-xl text-xs text-white/30 italic uppercase font-black tracking-wider">
                      No Logo Picture Attached
                    </div>
                  )}
                </div>

                {/* Supported Compliance Documents */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-wider block mb-2">
                      Supported Document: <span className="text-indigo-400 font-bold">{selectedBusiness.documentName || 'Compliance Certificate'}</span>
                    </span>
                    {selectedBusiness.documentImage ? (
                      <div className="h-64 flex items-center justify-center bg-slate-900/80 rounded-xl overflow-hidden p-2">
                        <img 
                          src={selectedBusiness.documentImage} 
                          alt="Supporting Certificate" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : selectedBusiness.proofImage ? (
                      <div className="h-64 flex items-center justify-center bg-slate-900/80 rounded-xl overflow-hidden p-2">
                        <img 
                          src={selectedBusiness.proofImage} 
                          alt="Fallback Certificate" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center bg-slate-900/50 rounded-xl text-xs text-white/30 italic uppercase font-black tracking-wider">
                        No Compliance Document Attached
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Profile details & Location */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block border-b border-white/10 pb-2">Business Profile Information</span>
                  
                  {/* Name & Owner */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-wider block">Company/Service Name</span>
                      <span className="text-sm font-black text-white">{selectedBusiness.name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-wider block">Applicant / Owner</span>
                      <span className="text-sm font-black text-white">{selectedBusiness.ownerName || 'Self'}</span>
                    </div>
                  </div>

                  {/* Contacts */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-wider block">Contact Phone</span>
                      <span className="text-xs font-mono font-bold text-white">{selectedBusiness.phone || 'Not Provided'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-wider block">Contact Email</span>
                      <span className="text-xs font-mono font-bold text-white break-all">{selectedBusiness.email || 'Not Provided'}</span>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-wider block">Street Address</span>
                      <span className="text-xs font-bold text-white">{selectedBusiness.streetAddress || 'Not Provided'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 uppercase tracking-wider block">Province</span>
                      <span className="text-xs font-bold text-white">{selectedBusiness.province || 'Not Provided'}</span>
                    </div>
                  </div>

                  {/* Geographic Location Coordinates */}
                  <div>
                    <span className="text-[9px] text-white/40 uppercase tracking-wider block">Pinpointed Map Location</span>
                    {selectedBusiness.location ? (
                      <span className="text-xs font-mono font-bold text-indigo-300">
                        Coordinates: {selectedBusiness.location.lat.toFixed(6)}, {selectedBusiness.location.lng.toFixed(6)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium italic text-white/30">No Geographic Location Pinned</span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="pt-4 border-t border-white/10 space-y-1">
                    <span className="text-[9px] text-white/40 uppercase tracking-wider block">Service Description</span>
                    <p className="text-xs text-white/80 font-medium leading-relaxed whitespace-pre-wrap">
                      {selectedBusiness.description || 'No business description provided.'}
                    </p>
                  </div>
                </div>

                {/* Decisions action buttons */}
                {selectedBusiness.status === 'pending' ? (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 shrink-0">
                    <button 
                      onClick={() => handleApproveBusiness(selectedBusiness.businessId)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-950/40 transition-colors"
                    >
                      Approve Profile
                    </button>
                    <button 
                      onClick={() => handleRejectBusiness(selectedBusiness.businessId)}
                      className="bg-white/10 text-white hover:bg-white/20 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      Reject Profile
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-white/5 rounded-xl text-xs font-black uppercase tracking-wider text-white/40 shrink-0">
                    Registration Reviewed • Status: <span className={selectedBusiness.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}>{selectedBusiness.status}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Business Directly Modal */}
      <AnimatePresence>
        {showAddBusinessModal && (
          <div className="fixed inset-0 z-[2200] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Add Business Directly</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddBusinessModal(false);
                    setNewBizImage(null);
                  }} 
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddBusinessDirectly} className="space-y-4 text-xs font-bold text-gray-700">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corporation"
                    value={newBizName}
                    onChange={(e) => setNewBizName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Email</label>
                  <input
                    type="email"
                    placeholder="info@acme.com"
                    value={newBizEmail}
                    onChange={(e) => setNewBizEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Document Type</label>
                  <select
                    value={newBizDocName}
                    onChange={(e) => setNewBizDocName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="CIPC Registration Certificate">CIPC Registration Certificate</option>
                    <option value="Company Tax Certificate">Company Tax Certificate</option>
                    <option value="ID Copies of Directors">ID Copies of Directors</option>
                    <option value="Proof of Address">Proof of Address</option>
                    <option value="Other Registration Document">Other Supporting Document</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Description</label>
                  <textarea
                    placeholder="Brief description of business services..."
                    value={newBizDesc}
                    onChange={(e) => setNewBizDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Upload Document Attachment (Optional)</label>
                  <input
                    type="file"
                    id="biz-image-uploader"
                    accept="image/*"
                    onChange={handleBizImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="biz-image-uploader"
                    className="flex items-center justify-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 hover:border-gray-400 py-3 rounded-xl cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">
                      {newBizImage ? 'Change Document Image' : 'Select Document Image'}
                    </span>
                  </label>
                  {newBizImage && (
                    <div className="mt-2 text-[10px] text-emerald-600 font-bold text-center">
                      ✓ Document file loaded successfully
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={addingBiz}
                    className="w-full bg-blue-900 hover:bg-blue-800 text-white py-3.5 rounded-xl font-black uppercase tracking-widest shadow-sm disabled:opacity-50"
                  >
                    {addingBiz ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Business & Approve'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
