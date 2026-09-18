import { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, updateDoc, doc, where } from '../lib/firebase';
import { Users, ShieldCheck, DollarSign, ArrowLeft, Check, X, FileText, Loader2, TrendingUp, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  role: string;
  idDocument?: string;
  isTenantRequest?: boolean;
  isTenantApproved?: boolean;
  subscriptionActive?: boolean;
  subscriptionExpiresAt?: string;
  createdAt: string;
}

interface AdminViewProps {
  onClose: () => void;
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

export default function AdminView({ onClose }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'verifications' | 'subscription'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tenantSubs, setTenantSubs] = useState<TenantSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIdDoc, setSelectedIdDoc] = useState<UserProfile | null>(null);
  const [selectedSubDoc, setSelectedSubDoc] = useState<TenantSubscription | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersList);
    });

    const subQ = query(collection(db, 'tenantSubscriptions'));
    const unsubscribeSubs = onSnapshot(subQ, (snapshot) => {
      const subsList = snapshot.docs.map(doc => ({
        subId: doc.id,
        ...doc.data()
      })) as TenantSubscription[];
      setTenantSubs(subsList);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeSubs();
    };
  }, []);

  const handleApproveSubscription = async (sub: TenantSubscription) => {
    try {
      // 1. Update sub status
      await updateDoc(doc(db, 'tenantSubscriptions', sub.subId), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });

      // 2. Update user status
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await updateDoc(doc(db, 'users', sub.tenantId), {
        subscriptionActive: true,
        subscriptionExpiresAt: expiresAt.toISOString(),
        updatedAt: new Date().toISOString()
      });
      setSelectedSubDoc(null);
    } catch (error: any) {
      console.error("Error approving sub", error);
      const errDetails = `Sub Approval Failed\nOperation: Update User & Subscription\nPath: users/${sub.tenantId} & tenantSubscriptions/${sub.subId}\nCode: ${error.code || 'UNKNOWN'}\nMessage: ${error.message || String(error)}`;
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
    } catch (error: any) {
      console.error("Error rejecting sub", error);
      setLastError(`Sub Rejection Failed: ${error.message} (Code: ${error.code})`);
      alert(`Rejection Failed\n${error.message}`);
    }
  };

  const handleApproveTenant = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isTenantApproved: true,
        isTenantRequest: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error approving tenant", error);
      setLastError(`Tenant Approval Failed: ${error.message} (Code: ${error.code}) - Path: users/${userId}`);
      alert(`Approval Failed\nOperation: Update User\nPath: users/${userId}\nCode: ${error.code}\nMessage: ${error.message}`);
    }
  };

  const handleRejectTenant = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isTenantApproved: false,
        isTenantRequest: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error rejecting tenant", error);
      setLastError(`Tenant Rejection Failed: ${error.message} (Code: ${error.code}) - Path: users/${userId}`);
      alert(`Rejection Failed\nOperation: Update User\nPath: users/${userId}\nCode: ${error.code}\nMessage: ${error.message}`);
    }
  };

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

  const pendingTenants = users.filter(u => u.isTenantRequest && !u.isTenantApproved);
  const activeTenants = users.filter(u => u.isTenantApproved);
  
  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-white z-[2000] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Top Menu Bar */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-4">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-widest">Admin Control</h1>
            <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">System Management</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab('verifications')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'verifications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Verifications</span>
            {pendingTenants.length > 0 && (
              <span className="bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px]">{pendingTenants.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('subscription')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'subscription' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Subs</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <Users className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Users</p>
                    <p className="text-2xl font-black text-gray-900">{users.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <ShieldCheck className="w-5 h-5 text-green-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verified Tenants</p>
                    <p className="text-2xl font-black text-gray-900">{activeTenants.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <DollarSign className="w-5 h-5 text-orange-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Subs</p>
                    <p className="text-2xl font-black text-gray-900">{users.filter(u => u.subscriptionActive).length}</p>
                  </div>
                </div>

                {lastError && (
                  <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-600">
                        <X className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Recent System Error</span>
                      </div>
                      <button 
                        onClick={() => setLastError(null)}
                        className="text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-600"
                      >
                        Clear Console
                      </button>
                    </div>
                    <div className="bg-white/50 p-4 rounded-xl border border-red-50">
                      <p className="text-[10px] font-mono font-bold text-red-600 break-all leading-relaxed">
                        {lastError}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                   <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Recent Activity</h3>
                   <div className="space-y-4">
                      {users.slice(0, 5).map(u => (
                        <div key={u.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                           <div className="flex items-center space-x-3">
                             <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
                               {u.photoURL && <img src={u.photoURL} alt="" className="w-full h-full object-cover" />}
                             </div>
                             <div>
                               <p className="text-xs font-bold text-gray-900">{u.displayName}</p>
                               <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">{u.role}</p>
                             </div>
                           </div>
                           <p className="text-[8px] text-gray-400 font-bold italic">{new Date(u.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'verifications' && (
              <motion.div 
                key="verifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Tenant Verification Requests</h3>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded font-black uppercase tracking-widest">{pendingTenants.length} Pending</span>
                </div>

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
                              <div className="w-12 h-12 bg-blue-50 rounded-2xl overflow-hidden shadow-sm">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Users className="w-6 h-6 text-blue-200" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-gray-900">{u.displayName}</h4>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{u.email || 'Tenant Applicant'}</p>
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
                            className="flex-1 bg-green-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg shadow-green-200 hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
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
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Pending Tenant Subscriptions</h3>
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
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">R {sub.amount.toFixed(2)}</p>
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
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Subscription Management</h3>
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                       <input 
                        type="text"
                        placeholder="Search tenants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-gray-50 border-none rounded-xl py-2 pl-9 pr-4 text-xs text-gray-900 focus:ring-2 focus:ring-gray-200"
                       />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredUsers.filter(u => u.isTenantApproved).map(u => (
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
                className="bg-green-600 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-green-900/40"
              >
                Approve Tenant
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
    </div>
  );
}
