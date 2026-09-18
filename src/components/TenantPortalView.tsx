import { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, updateDoc, doc, where } from '../lib/firebase';
import { Users, ShieldCheck, DollarSign, ArrowLeft, Check, X, FileText, Loader2, TrendingUp, Search } from 'lucide-react';
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

interface TenantPortalViewProps {
  onClose: () => void;
}

export default function TenantPortalView({ onClose }: TenantPortalViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'pop'>('overview');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'payments'), where('tenantId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsList = snapshot.docs.map(doc => ({
        paymentId: doc.id,
        ...doc.data()
      })) as Payment[];
      setPayments(paymentsList);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleApprovePayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      setSelectedPayment(null);
    } catch (error) {
      console.error("Error approving payment", error);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setSelectedPayment(null);
    } catch (error) {
      console.error("Error rejecting payment", error);
    }
  };

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const totalEarnings = payments.filter(p => p.status === 'approved').reduce((acc, curr) => acc + (curr.amount || 0), 0);

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
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab('pop')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pop' ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-300 hover:text-white'}`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PoP</span>
            {pendingPayments.length > 0 && (
              <span className="bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold">{pendingPayments.length}</span>
            )}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <DollarSign className="w-5 h-5 text-green-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Earnings</p>
                    <p className="text-2xl font-black text-gray-900">R {totalEarnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <ShieldCheck className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Approvals</p>
                    <p className="text-2xl font-black text-gray-900">{pendingPayments.length}</p>
                  </div>
                </div>

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
          </AnimatePresence>
        </div>
      </div>

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
