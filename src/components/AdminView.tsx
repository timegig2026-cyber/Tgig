import { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, updateDoc, doc, setDoc } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { calculateAdminFee, downloadTenantAgreement } from '../lib/utils';
import { 
  Users, ShieldCheck, DollarSign, ArrowLeft, Check, X, FileText, 
  TrendingUp, Search, AlertCircle, Ban, CheckCircle2, Sliders, 
  ShieldAlert, UserCheck, ShieldOff, Eye, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TENANT_AGREEMENT_TEXT } from '../constants/tenantAgreement';

interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: string;
  idDocument?: string;
  isTenantRequest?: boolean;
  isTenantApproved?: boolean;
  isTenantDisabled?: boolean;
  monthlySubscriptionFee?: number;
  subscriptionActive?: boolean;
  subscriptionExpiresAt?: string;
  tenantId?: string;
  tenantApproved?: boolean;
  userSubscriptionActive?: boolean;
  tenantAgreementAccepted?: boolean;
  tenantAgreementAcceptedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface TenantSubscription {
  subId: string;
  tenantId: string;
  tenantName: string;
  proofImage: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface Payment {
  paymentId: string;
  userId: string;
  tenantId: string;
  userDisplayName?: string;
  amount?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface AdminViewProps {
  onClose: () => void;
}

const DEFAULT_TENANT_CAP = 1000;

export default function AdminView({ onClose }: AdminViewProps) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'verifications' | 'subscription'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tenantSubs, setTenantSubs] = useState<TenantSubscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState<'all' | 'active' | 'disabled' | 'pending'>('all');
  const [selectedIdDoc, setSelectedIdDoc] = useState<UserProfile | null>(null);
  const [selectedSubDoc, setSelectedSubDoc] = useState<TenantSubscription | null>(null);
  const [showAgreementPreview, setShowAgreementPreview] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Tenant limit configuration
  const [tenantCap, setTenantCap] = useState<number>(DEFAULT_TENANT_CAP);
  const [showCapModal, setShowCapModal] = useState<boolean>(false);
  const [newCapInput, setNewCapInput] = useState<string>(String(DEFAULT_TENANT_CAP));

  useEffect(() => {
    const isUserAdmin = (user && user.email?.toLowerCase() === 'timegig2026@gmail.com') || profile?.isAdmin === true;
    if (!isUserAdmin) {
      setLoading(false);
      return;
    }

    // Load settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'admin'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tenantCap) {
          setTenantCap(data.tenantCap);
          setNewCapInput(String(data.tenantCap));
        }
      }
    });

    // Listen to users
    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(d => ({
        userId: d.id,
        ...d.data()
      })) as UserProfile[];
      setUsers(usersList);
    }, (err) => {
      console.warn("Could not subscribe to users in admin", err);
    });

    // Listen to tenant subscriptions (R299.99 platform fees)
    const subQ = query(collection(db, 'tenantSubscriptions'));
    const unsubscribeSubs = onSnapshot(subQ, (snapshot) => {
      const subsList = snapshot.docs.map(d => ({
        subId: d.id,
        ...d.data()
      })) as TenantSubscription[];
      setTenantSubs(subsList);
      setLoading(false);
    }, (err) => {
      console.warn("Could not subscribe to tenantSubscriptions in admin", err);
      setLoading(false);
    });

    // Listen to payments so Admin can see profit of every tenant in real-time
    const payQ = query(collection(db, 'payments'));
    const unsubscribePayments = onSnapshot(payQ, (snapshot) => {
      const paymentsList = snapshot.docs.map(d => ({
        paymentId: d.id,
        ...d.data()
      })) as Payment[];
      setPayments(paymentsList);
    }, (err) => {
      console.warn("Could not subscribe to payments in admin", err);
    });

    return () => {
      unsubSettings();
      unsubscribeUsers();
      unsubscribeSubs();
      unsubscribePayments();
    };
  }, [user, profile]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleApproveSubscription = async (sub: TenantSubscription) => {
    try {
      await updateDoc(doc(db, 'tenantSubscriptions', sub.subId), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await updateDoc(doc(db, 'users', sub.tenantId), {
        subscriptionActive: true,
        isTenantDisabled: false,
        subscriptionExpiresAt: expiresAt.toISOString(),
        updatedAt: new Date().toISOString()
      });
      setSelectedSubDoc(null);
      showNotification(`Subscription approved for ${sub.tenantName}`);
    } catch (error: any) {
      console.error("Error approving sub", error);
      const errDetails = `Sub Approval Failed: ${error.message}`;
      setLastError(errDetails);
      alert(errDetails);
    }
  };

  const handleRejectSubscription = async (subId: string) => {
    try {
      await updateDoc(doc(db, 'tenantSubscriptions', subId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setSelectedSubDoc(null);
      showNotification('Subscription rejected.');
    } catch (error: any) {
      console.error("Error rejecting sub", error);
      setLastError(`Sub Rejection Failed: ${error.message}`);
      alert(`Rejection Failed: ${error.message}`);
    }
  };

  const activeTenants = users.filter(u => u.isTenantApproved && !u.isTenantDisabled);
  const totalApprovedTenantsCount = users.filter(u => u.isTenantApproved).length;
  const pendingTenants = users.filter(u => u.isTenantRequest && !u.isTenantApproved);
  const disabledTenants = users.filter(u => u.isTenantDisabled);

  // Enforce the 1,000 tenant capacity rule
  const handleApproveTenant = async (userId: string) => {
    if (totalApprovedTenantsCount >= tenantCap) {
      const msg = `Maximum Tenant Capacity Reached!\nThe app currently only supports up to ${tenantCap.toLocaleString()} tenants until admin decides to expand capacity. Currently ${totalApprovedTenantsCount} approved tenants exist.`;
      setLastError(msg);
      alert(msg);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        isTenantApproved: true,
        isTenantRequest: false,
        isTenantDisabled: false,
        updatedAt: new Date().toISOString()
      });
      showNotification('Tenant approved successfully!');
    } catch (error: any) {
      console.error("Error approving tenant", error);
      setLastError(`Tenant Approval Failed: ${error.message}`);
      alert(`Approval Failed: ${error.message}`);
    }
  };

  const handleRejectTenant = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isTenantApproved: false,
        isTenantRequest: false,
        updatedAt: new Date().toISOString()
      });
      showNotification('Tenant request rejected.');
    } catch (error: any) {
      console.error("Error rejecting tenant", error);
      setLastError(`Tenant Rejection Failed: ${error.message}`);
      alert(`Rejection Failed: ${error.message}`);
    }
  };

  // Immediate disable/enable tenant account anytime
  const handleToggleTenantDisabled = async (tenantId: string, currentlyDisabled: boolean, tenantName: string) => {
    try {
      const newDisabledState = !currentlyDisabled;
      await updateDoc(doc(db, 'users', tenantId), {
        isTenantDisabled: newDisabledState,
        // If disabling, immediately lock subscription so portal and earnings are frozen
        ...(newDisabledState ? { subscriptionActive: false } : {}),
        updatedAt: new Date().toISOString()
      });
      showNotification(
        newDisabledState 
          ? `Tenant account for "${tenantName}" has been disabled immediately.` 
          : `Tenant account for "${tenantName}" has been re-enabled.`
      );
    } catch (error: any) {
      console.error("Error toggling tenant disabled state", error);
      const errDetails = `Failed to update tenant status: ${error.message}`;
      setLastError(errDetails);
      alert(errDetails);
    }
  };

  // Toggle tenant subscription status
  const handleToggleSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        subscriptionActive: !currentStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error toggling subscription", error);
    }
  };

  // Update tenant capacity limit (admin decides)
  const handleSaveTenantCap = async () => {
    const num = parseInt(newCapInput, 10);
    if (isNaN(num) || num < 1) {
      alert("Please enter a valid positive number for tenant capacity.");
      return;
    }
    
    try {
      await setDoc(doc(db, 'settings', 'admin'), {
        tenantCap: num,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid
      }, { merge: true });
      
      setTenantCap(num);
      setShowCapModal(false);
      showNotification(`Tenant capacity updated to ${num.toLocaleString()} maximum tenants.`);
    } catch (error: any) {
      console.error("Error saving tenant cap", error);
      alert("Failed to save capacity limit: " + error.message);
    }
  };

  // Helper to compute stats for each tenant
  const getTenantStats = (tenantId: string) => {
    const tenantReferredUsers = users.filter(u => u.tenantId === tenantId);
    const totalUsers = tenantReferredUsers.length;
    const activeUsers = tenantReferredUsers.filter(u => u.tenantApproved || u.userSubscriptionActive).length;
    
    // Total profit: approved payments where tenantId == tenantId
    const tenantApprovedPayments = payments.filter(p => p.tenantId === tenantId && p.status === 'approved');
    const totalProfit = tenantApprovedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    return {
      totalUsers,
      activeUsers,
      totalProfit,
      approvedPaymentsCount: tenantApprovedPayments.length
    };
  };

  // All tenants (approved, disabled, or requested)
  const allTenants = users.filter(u => u.isTenantApproved || u.isTenantRequest || u.isTenantDisabled);

  // Platform-wide tenant stats
  const totalTenantProfitAll = payments
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalReferredUsersAll = users.filter(u => !!u.tenantId).length;

  const filteredTenants = allTenants.filter(t => {
    if (tenantFilter === 'active') return t.isTenantApproved && !t.isTenantDisabled;
    if (tenantFilter === 'disabled') return t.isTenantDisabled;
    if (tenantFilter === 'pending') return t.isTenantRequest && !t.isTenantApproved;
    return true;
  }).filter(t => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      (t.displayName || '').toLowerCase().includes(term) ||
      (t.email || '').toLowerCase().includes(term) ||
      t.userId.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Menu Bar */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Return to profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <span>Admin Control</span>
              <span className="bg-red-600 text-[8px] font-black px-1.5 py-0.5 rounded text-white tracking-widest uppercase">
                Root
              </span>
            </h1>
            <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
              Multi-Tenant Governance & Capacity
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>

          <button 
            onClick={() => setActiveTab('tenants')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'tenants' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tenants & Profit</span>
            <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
              {allTenants.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('verifications')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'verifications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Requests</span>
            {pendingTenants.length > 0 && (
              <span className="bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">
                {pendingTenants.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('subscription')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'subscription' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Subs</span>
            {tenantSubs.filter(s => s.status === 'pending').length > 0 && (
              <span className="bg-orange-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">
                {tenantSubs.filter(s => s.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="bg-emerald-600 text-white py-2 px-4 text-center text-xs font-bold tracking-wide shadow-md flex items-center justify-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-5xl mx-auto p-6 space-y-6">

          {/* System Policy Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start space-x-3 text-xs">
            <UserCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-blue-900 uppercase tracking-wider text-[10px]">
                Tenant Self-Governed Member Approval Policy
              </p>
              <p className="text-blue-800 text-[11px] leading-relaxed">
                Tenants approve their own users who joined through their referral link. The Admin dashboard provides overarching multi-tenant visibility (total users &amp; profit of every tenant), immediate account disabling, and enforced tenant capacity (capped at {tenantCap.toLocaleString()} tenants).
              </p>
            </div>
          </div>

          {lastError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-red-800 uppercase tracking-wider">Alert</p>
                  <p className="text-xs font-mono text-red-700 mt-1 whitespace-pre-wrap">{lastError}</p>
                </div>
              </div>
              <button 
                onClick={() => setLastError(null)}
                className="text-red-400 hover:text-red-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* 4 Primary Metric Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <Users className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Platform Users</p>
                    <p className="text-2xl font-black text-gray-900">{users.length}</p>
                    <p className="text-[9px] text-gray-400 mt-1 font-medium">{totalReferredUsersAll} referred by tenants</p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Approved Tenants</p>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-black text-gray-900">{totalApprovedTenantsCount}</span>
                      <span className="text-xs font-black text-gray-400">/ {tenantCap.toLocaleString()}</span>
                    </div>
                    <p className="text-[9px] text-emerald-600 font-bold mt-1">
                      {((totalApprovedTenantsCount / tenantCap) * 100).toFixed(1)}% capacity used
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <DollarSign className="w-5 h-5 text-emerald-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">All Tenants Profit</p>
                    <p className="text-2xl font-black text-emerald-600">R {totalTenantProfitAll.toFixed(2)}</p>
                    <p className="text-[9px] text-gray-400 mt-1 font-medium">Earned by tenants via referrals</p>
                  </div>

                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <Ban className="w-5 h-5 text-red-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disabled Tenants</p>
                    <p className="text-2xl font-black text-red-600">{disabledTenants.length}</p>
                    <p className="text-[9px] text-gray-400 mt-1 font-medium">{pendingTenants.length} pending review</p>
                  </div>
                </div>

                {/* Tenant 1,000 Capacity Limit Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Sliders className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                          Application Tenant Capacity Limit
                        </h3>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        App strictly supports up to <strong>{tenantCap.toLocaleString()} tenants</strong> until admin decides otherwise.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setNewCapInput(String(tenantCap));
                        setShowCapModal(true);
                      }}
                      className="inline-flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all self-start sm:self-auto"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Adjust Capacity Cap</span>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-gray-500">
                      <span>{totalApprovedTenantsCount} Approved Tenants</span>
                      <span>Cap: {tenantCap.toLocaleString()} Tenants</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          totalApprovedTenantsCount >= tenantCap 
                            ? 'bg-red-500' 
                            : totalApprovedTenantsCount >= tenantCap * 0.85 
                              ? 'bg-amber-500' 
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (totalApprovedTenantsCount / tenantCap) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 font-medium">
                      <span>Remaining Slots: {Math.max(0, tenantCap - totalApprovedTenantsCount)} slots available</span>
                      <span>Status: {totalApprovedTenantsCount >= tenantCap ? 'Capacity Reached (Locked)' : 'Accepting Applications'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Tenants Spotlight Preview */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                        Top Tenant Profit &amp; Network Leaders
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        Real-time user volume and profit breakdown
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('tenants')}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest"
                    >
                      View All Tenants →
                    </button>
                  </div>

                  <div className="space-y-3">
                    {allTenants.slice(0, 5).map(tenant => {
                      const stats = getTenantStats(tenant.userId);
                      const customFee = tenant.monthlySubscriptionFee !== undefined ? tenant.monthlySubscriptionFee : 99.00;

                      return (
                        <div 
                          key={tenant.userId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 gap-3"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-gray-200">
                              {tenant.photoURL ? (
                                <img src={tenant.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-black text-blue-900">
                                  {(tenant.displayName || 'T').charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-xs font-black text-gray-900">{tenant.displayName}</p>
                                {tenant.isTenantDisabled ? (
                                  <span className="bg-red-100 text-red-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                                    Disabled
                                  </span>
                                ) : tenant.isTenantApproved ? (
                                  <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                                    Active
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-gray-400 font-mono">{tenant.email || tenant.userId}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Total Users</p>
                              <p className="text-xs font-black text-gray-900">{stats.totalUsers} users ({stats.activeUsers} active)</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Total Profit</p>
                              <p className="text-xs font-black text-emerald-600">R {stats.totalProfit.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Fee</p>
                              <p className="text-xs font-black text-blue-900">R {customFee.toFixed(2)}/mo</p>
                            </div>

                            <button
                              onClick={() => handleToggleTenantDisabled(tenant.userId, !!tenant.isTenantDisabled, tenant.displayName)}
                              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                tenant.isTenantDisabled
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-red-50 hover:bg-red-100 text-red-600'
                              }`}
                            >
                              {tenant.isTenantDisabled ? 'Enable' : 'Disable'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {allTenants.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-6">No tenant accounts found in system.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TENANTS & PROFIT TAB */}
            {activeTab === 'tenants' && (
              <motion.div 
                key="tenants"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Search & Filter Header */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                        All Tenants: Users &amp; Profit Directory
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        Admin can monitor profit, total referred users, and disable accounts immediately
                      </p>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        placeholder="Search by name, email or ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                      />
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setTenantFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        tenantFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All Tenants ({allTenants.length})
                    </button>
                    <button
                      onClick={() => setTenantFilter('active')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        tenantFilter === 'active' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Active ({activeTenants.length})
                    </button>
                    <button
                      onClick={() => setTenantFilter('disabled')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        tenantFilter === 'disabled' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Disabled by Admin ({disabledTenants.length})
                    </button>
                    <button
                      onClick={() => setTenantFilter('pending')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        tenantFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Pending Verification ({pendingTenants.length})
                    </button>
                  </div>
                </div>

                {/* Tenants Cards Grid */}
                <div className="space-y-4">
                  {filteredTenants.map(tenant => {
                    const stats = getTenantStats(tenant.userId);
                    const customFee = tenant.monthlySubscriptionFee !== undefined ? tenant.monthlySubscriptionFee : 99.00;

                    return (
                      <div 
                        key={tenant.userId}
                        className={`bg-white rounded-3xl p-6 border shadow-sm transition-all space-y-4 ${
                          tenant.isTenantDisabled 
                            ? 'border-red-200 bg-red-50/20' 
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {/* Tenant Header & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-3.5">
                            <div className="w-12 h-12 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-200 shrink-0">
                              {tenant.photoURL ? (
                                <img src={tenant.photoURL} alt={tenant.displayName} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-black text-gray-900">{tenant.displayName}</h4>
                                {tenant.isTenantDisabled ? (
                                  <span className="inline-flex items-center space-x-1 bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                    <ShieldOff className="w-2.5 h-2.5" />
                                    <span>Disabled by Admin</span>
                                  </span>
                                ) : tenant.isTenantApproved ? (
                                  <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    <span>Active Tenant</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                                    <span>Pending Approval</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                {tenant.email || 'No email provided'} • ID: {tenant.userId}
                              </p>
                            </div>
                          </div>

                          {/* Immediate Admin Action Buttons */}
                          <div className="flex items-center space-x-2 self-end sm:self-center">
                            {tenant.isTenantDisabled ? (
                              <button
                                onClick={() => handleToggleTenantDisabled(tenant.userId, true, tenant.displayName)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 shadow-sm transition-all"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Enable Tenant</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleTenantDisabled(tenant.userId, false, tenant.displayName)}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5 shadow-sm shadow-red-200 transition-all"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Disable Immediately</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Metrics Bar for this Tenant */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Users</p>
                            <p className="text-base font-black text-gray-900 mt-0.5">{stats.totalUsers}</p>
                            <p className="text-[8px] text-gray-400 font-bold">Joined via tenant link</p>
                          </div>

                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Active Approved</p>
                            <p className="text-base font-black text-emerald-600 mt-0.5">{stats.activeUsers}</p>
                            <p className="text-[8px] text-gray-400 font-bold">Active subscriptions</p>
                          </div>

                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Tenant Total Profit</p>
                            <p className="text-base font-black text-emerald-700 mt-0.5">R {stats.totalProfit.toFixed(2)}</p>
                            <p className="text-[8px] text-gray-400 font-bold">{stats.approvedPaymentsCount} approved proofs</p>
                          </div>

                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Monthly Fee (Custom)</p>
                            <p className="text-base font-black text-blue-900 mt-0.5">R {customFee.toFixed(2)}/mo</p>
                            <p className="text-[8px] text-gray-400 font-bold">Set by this tenant</p>
                          </div>
                        </div>

                        {tenant.isTenantDisabled && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center space-x-2 text-red-700 text-xs">
                            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="text-[10px] font-bold">
                              This tenant is disabled immediately by Admin. Tenant portal access, referral link onboarding, and passive earnings are locked.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredTenants.length === 0 && (
                    <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm space-y-2">
                      <Users className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-xs font-black text-gray-900 uppercase tracking-wider">No tenants found</p>
                      <p className="text-[11px] text-gray-500">Try changing your search query or filter selection.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* VERIFICATIONS TAB */}
            {activeTab === 'verifications' && (
              <motion.div 
                key="verifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                      Tenant Verification Requests
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                      Enforcing maximum tenant limit of {tenantCap.toLocaleString()} tenants
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded font-black uppercase tracking-widest">
                      {pendingTenants.length} Pending
                    </span>
                    <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded font-black uppercase tracking-widest">
                      {totalApprovedTenantsCount} / {tenantCap.toLocaleString()} Slots
                    </span>
                  </div>
                </div>

                {totalApprovedTenantsCount >= tenantCap && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-800 text-xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black uppercase tracking-wider text-[10px]">Tenant Capacity Limit Reached</p>
                      <p className="text-[11px] mt-0.5">
                        The platform has reached its maximum quota of {tenantCap.toLocaleString()} approved tenants. You must expand the capacity cap above before approving additional tenants.
                      </p>
                    </div>
                  </div>
                )}

                {pendingTenants.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm space-y-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">No pending verification requests</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingTenants.map(u => (
                      <div key={u.userId} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl overflow-hidden shadow-sm flex items-center justify-center">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-6 h-6 text-blue-200" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-gray-900">{u.displayName}</h4>
                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{u.email || 'Tenant Applicant'}</p>
                              {u.tenantAgreementAccepted ? (
                                <div className="flex items-center space-x-2 mt-1">
                                  <div className="flex items-center space-x-1 text-[8px] font-black text-green-600 uppercase tracking-widest">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    <span>Agreement Accepted</span>
                                  </div>
                                  <button 
                                    onClick={() => setShowAgreementPreview(true)}
                                    className="p-1 hover:bg-gray-100 rounded text-[8px] font-black text-blue-600 uppercase tracking-widest flex items-center space-x-1"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                    <span>View</span>
                                  </button>
                                  <button 
                                    onClick={() => downloadTenantAgreement(u.displayName, u.email || 'N/A', u.tenantAgreementAcceptedAt || u.updatedAt || new Date().toISOString(), TENANT_AGREEMENT_TEXT)}
                                    className="p-1 hover:bg-gray-100 rounded text-[8px] font-black text-emerald-600 uppercase tracking-widest flex items-center space-x-1"
                                    title="Download Signed Agreement"
                                  >
                                    <Download className="w-2.5 h-2.5" />
                                    <span>Download</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-[8px] font-black text-red-500 uppercase tracking-widest mt-1">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  <span>No Agreement Found</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {u.idDocument && (
                          <div 
                            onClick={() => setSelectedIdDoc(u)}
                            className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Click to View ID Document</span>
                            </div>
                            <div className="h-40 w-full overflow-hidden rounded-xl border border-gray-200 bg-white">
                              <img src={u.idDocument} alt="ID Document" className="w-full h-full object-contain" />
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-2 pt-2">
                          <button 
                            onClick={() => handleApproveTenant(u.userId)}
                            disabled={totalApprovedTenantsCount >= tenantCap}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg transition-colors ${
                              totalApprovedTenantsCount >= tenantCap 
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{totalApprovedTenantsCount >= tenantCap ? 'Cap Reached' : 'Approve'}</span>
                          </button>
                          <button 
                            onClick={() => handleRejectTenant(u.userId)}
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

            {/* SUBSCRIPTION TAB */}
            {activeTab === 'subscription' && (
              <motion.div 
                key="subscription"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                        Tenant Platform Activation Subscriptions (R299.99)
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                        Payments made by tenants to unlock their personal tenant portal
                      </p>
                    </div>
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded font-black uppercase tracking-widest">
                      {tenantSubs.filter(s => s.status === 'pending').length} Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenantSubs.filter(s => s.status === 'pending').map(sub => (
                      <div key={sub.subId} className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900">{sub.tenantName}</p>
                            <div className="flex flex-col">
                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Paid: R {sub.amount.toFixed(2)}</p>
                              {(() => {
                                const tenant = users.find(u => u.userId === sub.tenantId);
                                if (tenant) {
                                  const activeReferrals = users.filter(u => u.tenantId === tenant.userId && u.userSubscriptionActive).length;
                                  const expected = calculateAdminFee(activeReferrals);
                                  return (
                                    <p className={`text-[8px] font-black uppercase tracking-widest ${Math.abs(sub.amount - expected) < 0.01 ? 'text-green-500' : 'text-red-500'}`}>
                                      Expected: R {expected.toFixed(2)} ({activeReferrals} referrals)
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>

                        <div 
                          onClick={() => setSelectedSubDoc(sub)}
                          className="h-32 w-full overflow-hidden rounded-xl border border-gray-200 bg-white cursor-pointer"
                        >
                          <img src={sub.proofImage} alt="Sub PoP" className="w-full h-full object-contain" />
                        </div>

                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleApproveSubscription(sub)}
                            className="flex-1 bg-green-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button 
                            onClick={() => handleRejectSubscription(sub.subId)}
                            className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))}

                    {tenantSubs.filter(s => s.status === 'pending').length === 0 && (
                      <div className="col-span-full py-8 text-center text-xs text-gray-400 italic">
                        No pending tenant platform subscriptions to review.
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub Management List */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    Tenant Platform Subscription Statuses
                  </h3>

                  <div className="space-y-3">
                    {users.filter(u => u.isTenantApproved).map(u => (
                      <div key={u.userId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900">{u.displayName}</p>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className={`w-2 h-2 rounded-full ${u.subscriptionActive ? 'bg-green-500' : 'bg-red-500'}`} />
                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                {u.subscriptionActive ? 'Active' : 'Inactive'} • {u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).toLocaleDateString() : 'No expiry'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleToggleSubscription(u.userId, u.subscriptionActive || false)}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                            u.subscriptionActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {u.subscriptionActive ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Adjust Tenant Capacity Modal */}
      <AnimatePresence>
        {showCapModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2200] bg-black/70 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    Adjust Platform Tenant Limit
                  </h3>
                </div>
                <button onClick={() => setShowCapModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[11px] text-gray-600 leading-relaxed">
                The application supports up to <strong>1,000 tenants</strong> by default until admin decides otherwise. You can expand or adjust this capacity limit here at any time.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Maximum Supported Tenants
                </label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={newCapInput}
                  onChange={(e) => setNewCapInput(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  onClick={handleSaveTenantCap}
                  className="flex-1 bg-blue-900 hover:bg-blue-800 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Save Capacity Limit
                </button>
                <button
                  onClick={() => setShowCapModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Sub Doc View Modal */}
      <AnimatePresence>
        {selectedSubDoc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] bg-black/95 flex flex-col p-6"
          >
            <div className="flex items-center justify-between text-white mb-8">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">{selectedSubDoc.tenantName}</h3>
                <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Tenant Subscription Payment Proof</p>
              </div>
              <button onClick={() => setSelectedSubDoc(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <img 
                src={selectedSubDoc.proofImage} 
                alt="Full Proof" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <button 
                onClick={() => handleApproveSubscription(selectedSubDoc)}
                className="bg-green-600 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest"
              >
                Approve Payment
              </button>
              <button 
                onClick={() => handleRejectSubscription(selectedSubDoc.subId)}
                className="bg-white/10 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest"
              >
                Reject Payment
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen ID View Modal */}
      <AnimatePresence>
        {selectedIdDoc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] bg-black/95 flex flex-col p-6"
          >
            <div className="flex items-center justify-between text-white mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20">
                  {selectedIdDoc.photoURL && <img src={selectedIdDoc.photoURL} alt="" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{selectedIdDoc.displayName}</h3>
                  <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Official ID Document Verification</p>
                </div>
              </div>
              <button onClick={() => setSelectedIdDoc(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              <img 
                src={selectedIdDoc.idDocument} 
                alt="Full ID" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <button 
                onClick={() => {
                  handleApproveTenant(selectedIdDoc.userId);
                  setSelectedIdDoc(null);
                }}
                disabled={totalApprovedTenantsCount >= tenantCap}
                className={`py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all ${
                  totalApprovedTenantsCount >= tenantCap
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/40'
                }`}
              >
                {totalApprovedTenantsCount >= tenantCap ? 'Capacity Reached' : 'Approve Tenant'}
              </button>
              <button 
                onClick={() => {
                  handleRejectTenant(selectedIdDoc.userId);
                  setSelectedIdDoc(null);
                }}
                className="bg-white/10 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
              >
                Reject Tenant
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agreement Preview Modal */}
      {showAgreementPreview && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg h-[80vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Standard Tenant Agreement</h3>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Reviewing terms accepted by user</p>
              </div>
              <button 
                onClick={() => setShowAgreementPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="prose prose-sm max-w-none">
                {TENANT_AGREEMENT_TEXT.split('\n').map((line, i) => (
                  <p key={i} className={`text-[11px] leading-relaxed text-gray-600 ${line.match(/^\d+\. /) ? 'font-black text-gray-900 mt-6 mb-2 uppercase' : ''}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowAgreementPreview(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
