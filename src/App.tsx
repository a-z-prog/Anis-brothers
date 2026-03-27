/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  updateDoc,
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp, 
  increment,
  writeBatch,
  doc,
  where,
  getDocs,
  User
} from './firebase';
import { 
  Users, 
  Plus, 
  History, 
  TrendingUp, 
  LogOut, 
  LogIn, 
  UserPlus, 
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ChevronRight,
  Calendar,
  Receipt,
  Edit,
  X,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { format } from 'date-fns';

// Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Member {
  id: string;
  name: string;
  phone?: string;
  joinedAt: Timestamp;
  totalSavings: number;
  shares: number;
}

interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  date: Timestamp;
  addedBy: string;
}

interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: Timestamp;
  addedBy: string;
}

interface Income {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: Timestamp;
  addedBy: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };
  props: any;
  
  constructor(props: any) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error) {
          errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="max-w-md w-full border border-black p-8 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-tighter mb-4">System Error</h1>
            <p className="font-mono text-sm text-gray-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-black text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'members' | 'history' | 'expenses' | 'incomes' | 'all_history'>('dashboard');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [newMember, setNewMember] = useState({ name: '', phone: '', joinedAt: format(new Date(), 'yyyy-MM-dd'), shares: '1' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', joinedAt: '', shares: '1' });
  const [newTx, setNewTx] = useState({ memberId: '', amount: '', type: 'deposit' as 'deposit' | 'withdrawal' });
  const [newExpense, setNewExpense] = useState({ title: '', category: 'Meeting', amount: '' });
  const [newIncome, setNewIncome] = useState({ title: '', category: 'Others', amount: '' });

  const isAdmin = user?.email === 'mhrajin90@gmail.com';

  const expenseCategories = ['Meeting', 'Food', 'Transport', 'Bank Charge', 'Others'];
  const incomeCategories = ['Investment', 'Donation', 'Bank Interest', 'Others'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qMembers = query(collection(db, 'members'), orderBy('name', 'asc'));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'members');
    });

    const qTx = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    const qExp = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'expenses');
    });

    const qInc = query(collection(db, 'incomes'), orderBy('date', 'desc'));
    const unsubInc = onSnapshot(qInc, (snapshot) => {
      setIncomes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'incomes');
    });

    return () => {
      unsubMembers();
      unsubTx();
      unsubExp();
      unsubInc();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/network-request-failed') {
        alert("Login failed: Network error. Please check your internet connection or ensure your domain is authorized in Firebase Console.");
      } else {
        alert(`Login failed: ${error.message}`);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name) return;

    try {
      await addDoc(collection(db, 'members'), {
        name: newMember.name,
        phone: newMember.phone,
        joinedAt: Timestamp.fromDate(new Date(newMember.joinedAt)),
        totalSavings: 0,
        shares: parseInt(newMember.shares) || 1
      });
      setNewMember({ name: '', phone: '', joinedAt: format(new Date(), 'yyyy-MM-dd'), shares: '1' });
      setIsAddingMember(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'members');
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    try {
      const memberRef = doc(db, 'members', editingMember.id);
      const nameChanged = editingMember.name !== editForm.name;

      if (nameChanged) {
        // If name changed, we need to update all transactions for this member to keep history consistent
        const q = query(collection(db, 'transactions'), where('memberId', '==', editingMember.id));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        batch.update(memberRef, {
          name: editForm.name,
          phone: editForm.phone,
          joinedAt: Timestamp.fromDate(new Date(editForm.joinedAt)),
          shares: parseInt(editForm.shares) || 1
        });

        querySnapshot.forEach((txDoc) => {
          batch.update(txDoc.ref, { memberName: editForm.name });
        });
        
        await batch.commit();
      } else {
        await updateDoc(memberRef, {
          name: editForm.name,
          phone: editForm.phone,
          joinedAt: Timestamp.fromDate(new Date(editForm.joinedAt)),
          shares: parseInt(editForm.shares) || 1
        });
      }
      
      setEditingMember(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${editingMember.id}`);
    }
  };

  const startEditing = (member: Member) => {
    setEditForm({
      name: member.name,
      phone: member.phone || '',
      joinedAt: format(member.joinedAt.toDate(), 'yyyy-MM-dd'),
      shares: (member.shares || 1).toString()
    });
    setEditingMember(member);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newTx.amount);
    if (!newTx.memberId || isNaN(amount) || amount <= 0) return;

    const member = members.find(m => m.id === newTx.memberId);
    if (!member) return;

    try {
      const batch = writeBatch(db);
      
      // Add transaction
      const txRef = doc(collection(db, 'transactions'));
      batch.set(txRef, {
        memberId: newTx.memberId,
        memberName: member.name,
        amount,
        type: newTx.type,
        date: Timestamp.now(),
        addedBy: user?.uid
      });

      // Update member total
      const memberRef = doc(db, 'members', newTx.memberId);
      batch.update(memberRef, {
        totalSavings: increment(newTx.type === 'deposit' ? amount : -amount)
      });

      await batch.commit();
      setNewTx({ memberId: '', amount: '', type: 'deposit' });
      setIsAddingTransaction(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions & member update');
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newExpense.amount);
    if (!newExpense.title || isNaN(amount) || amount <= 0) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        title: newExpense.title,
        category: newExpense.category,
        amount,
        date: Timestamp.now(),
        addedBy: user?.uid
      });
      setNewExpense({ title: '', category: 'Meeting', amount: '' });
      setIsAddingExpense(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newIncome.amount);
    if (!newIncome.title || isNaN(amount) || amount <= 0) return;

    try {
      await addDoc(collection(db, 'incomes'), {
        title: newIncome.title,
        category: newIncome.category,
        amount,
        date: Timestamp.now(),
        addedBy: user?.uid
      });
      setNewIncome({ title: '', category: 'Others', amount: '' });
      setIsAddingIncome(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incomes');
    }
  };

  const getMemberNameById = (memberId: string, fallbackName: string) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.name : fallbackName;
  };

  const totalSavings = members.reduce((sum, m) => sum + m.totalSavings, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalGeneralIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const netBalance = totalSavings + totalGeneralIncome - totalExpenses;

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.phone?.includes(searchTerm)
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 bg-black flex items-center justify-center rounded-full">
              <CircleDollarSign className="text-white w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tighter uppercase italic font-serif text-black">Anis Brothers</h1>
              <p className="text-gray-500 mt-2 font-mono text-sm uppercase tracking-widest">Savings Cooperative</p>
            </div>
            
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase text-gray-500 font-bold text-left">Authorized Only</p>
                <button 
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-black text-white py-4 px-6 hover:bg-gray-800 transition-colors font-bold uppercase tracking-widest"
                >
                  <ShieldCheck size={20} />
                  Admin Login
                </button>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase text-gray-500 font-bold text-left">Public Access</p>
                <button 
                  onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-3 border border-black bg-white text-black py-4 px-6 hover:bg-gray-50 transition-colors font-bold uppercase tracking-widest"
                >
                  <Users size={20} />
                  Member Access
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-black font-sans">
      {/* Header */}
      <header className="border-b border-black bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign size={24} />
            <h1 className="font-bold uppercase tracking-tighter italic font-serif text-xl">Anis Brothers</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-100 border border-black rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-mono uppercase font-bold">{user.displayName}</span>
              {!isAdmin && <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-[8px] border border-black/20 rounded font-bold">View Only</span>}
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 border border-transparent hover:border-black transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-black mb-8 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'all_history', label: 'All History', icon: History },
            { id: 'history', label: 'Savings History', icon: History },
            { id: 'incomes', label: 'Income History', icon: TrendingUp },
            { id: 'expenses', label: 'Expense History', icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 font-bold uppercase tracking-widest text-sm transition-all border-b-2 border-transparent",
                activeTab === tab.id ? "border-black bg-white" : "text-gray-500 hover:text-black"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-mono uppercase text-gray-500 mb-2">Total Savings (Members)</p>
                  <h2 className="text-4xl font-bold font-mono tracking-tighter">
                    ৳{totalSavings.toLocaleString()}
                  </h2>
                </div>
                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-mono uppercase text-gray-500 mb-2">General Income</p>
                  <h2 className="text-4xl font-bold font-mono tracking-tighter text-green-600">
                    ৳{totalGeneralIncome.toLocaleString()}
                  </h2>
                </div>
                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <p className="text-xs font-mono uppercase text-gray-500 mb-2">Total Expenses</p>
                  <h2 className="text-4xl font-bold font-mono tracking-tighter text-red-600">
                    ৳{totalExpenses.toLocaleString()}
                  </h2>
                </div>
                <div className="bg-black text-white p-6 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                  <p className="text-xs font-mono uppercase text-gray-400 mb-2">Net Fund Balance</p>
                  <h2 className="text-4xl font-bold font-mono tracking-tighter">
                    ৳{netBalance.toLocaleString()}
                  </h2>
                </div>
              </div>

              {/* Quick Actions (Admin Only) */}
              {isAdmin && (
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => setIsAddingTransaction(true)}
                    className="flex items-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                  >
                    <Plus size={18} />
                    Add Savings
                  </button>
                  <button 
                    onClick={() => setIsAddingIncome(true)}
                    className="flex items-center gap-2 border border-black bg-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    <TrendingUp size={18} />
                    Add Income
                  </button>
                  <button 
                    onClick={() => setIsAddingExpense(true)}
                    className="flex items-center gap-2 border border-black bg-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    <Receipt size={18} />
                    Add Expense
                  </button>
                  <button 
                    onClick={() => setIsAddingMember(true)}
                    className="flex items-center gap-2 border border-black bg-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-100 transition-all"
                  >
                    <UserPlus size={18} />
                    Add Member
                  </button>
                </div>
              )}

              {/* Top Savers List */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-black overflow-hidden">
                  <div className="p-4 border-b border-black bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold uppercase tracking-widest text-sm">Top Savers</h3>
                    <TrendingUp size={16} />
                  </div>
                  <div className="divide-y divide-black">
                    {[...members].sort((a, b) => b.totalSavings - a.totalSavings).slice(0, 5).map((member, i) => (
                      <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-xs text-gray-400">0{i + 1}</span>
                          <div>
                            <p className="font-bold uppercase text-sm">{member.name}</p>
                            <p className="text-xs font-mono text-gray-500">{member.phone || 'No phone'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold font-mono">৳{member.totalSavings.toLocaleString()}</p>
                          <p className="text-[10px] font-mono uppercase text-green-600">Active</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Activity (Combined History) */}
                <div className="bg-white border border-black overflow-hidden">
                  <div className="p-4 border-b border-black bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold uppercase tracking-widest text-sm">Recent Activity</h3>
                    <button 
                      onClick={() => setActiveTab('all_history')}
                      className="text-[10px] font-mono uppercase underline hover:text-gray-600 flex items-center gap-1"
                    >
                      View All <History size={12} />
                    </button>
                  </div>
                  <div className="divide-y divide-black">
                    {[
                      ...transactions.map(t => ({ ...t, kind: 'transaction' as const })),
                      ...expenses.map(e => ({ ...e, kind: 'expense' as const })),
                      ...incomes.map(i => ({ ...i, kind: 'income' as const }))
                    ]
                    .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
                    .slice(0, 5)
                    .map((item, i) => (
                      <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-8 h-8 flex items-center justify-center border border-black",
                            'kind' in item && item.kind === 'expense' ? "bg-red-50" : "bg-green-50"
                          )}>
                            {'kind' in item && item.kind === 'expense' ? <Receipt size={14} className="text-red-600" /> : <TrendingUp size={14} className="text-green-600" />}
                          </div>
                          <div>
                            <p className="font-bold uppercase text-[10px] leading-tight mb-0.5">
                              {'kind' in item && item.kind === 'expense' ? item.title : 
                               'kind' in item && item.kind === 'income' ? item.title : 
                               getMemberNameById((item as any).memberId, (item as any).memberName)}
                            </p>
                            <p className="text-[9px] font-mono text-gray-500 uppercase">
                              {format(item.date.toDate(), 'MMM d')} • {'kind' in item && item.kind === 'expense' ? 'Expense' : 'kind' in item && item.kind === 'income' ? 'Income' : (item as any).type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-bold font-mono text-xs",
                            'kind' in item && item.kind === 'expense' ? "text-red-600" : 
                            'kind' in item && item.kind === 'income' ? "text-green-600" :
                            (item as any).type === 'deposit' ? "text-green-600" : "text-red-600"
                          )}>
                            {('kind' in item && item.kind === 'expense') || (item as any).type === 'withdrawal' ? '-' : '+'}৳{item.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {transactions.length === 0 && expenses.length === 0 && incomes.length === 0 && (
                      <div className="p-12 text-center text-gray-500 font-mono text-[10px] uppercase">
                        No recent activity
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'all_history' && (
            <motion.div 
              key="all_history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold uppercase italic font-serif">Full Activity History (সব ইতিহাস)</h2>
              </div>

              <div className="bg-white border border-black overflow-hidden">
                <div className="grid grid-cols-4 p-4 border-b border-black bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  <div>Date</div>
                  <div>Details</div>
                  <div className="text-right">Type</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="divide-y divide-black">
                  {[
                    ...transactions.map(t => ({ ...t, kind: 'transaction' as const })),
                    ...expenses.map(e => ({ ...e, kind: 'expense' as const })),
                    ...incomes.map(i => ({ ...i, kind: 'income' as const }))
                  ]
                  .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime())
                  .map((item, i) => (
                    <div key={i} className="grid grid-cols-4 p-4 items-center hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <Calendar size={12} />
                        {format(item.date.toDate(), 'MMM d, yyyy')}
                      </div>
                      <div className="font-bold uppercase text-xs truncate pr-2">
                        {'kind' in item && item.kind === 'expense' ? item.title : 
                         'kind' in item && item.kind === 'income' ? item.title : 
                         getMemberNameById((item as any).memberId, (item as any).memberName)}
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-[10px] font-mono uppercase px-2 py-0.5 border",
                          'kind' in item && item.kind === 'expense' ? "border-red-500 text-red-600 bg-red-50" : 
                          'kind' in item && item.kind === 'income' ? "border-green-500 text-green-600 bg-green-50" :
                          (item as any).type === 'deposit' ? "border-green-500 text-green-600 bg-green-50" : "border-red-500 text-red-600 bg-red-50"
                        )}>
                          {'kind' in item && item.kind === 'expense' ? 'Expense' : 
                           'kind' in item && item.kind === 'income' ? 'Income' : 
                           (item as any).type}
                        </span>
                      </div>
                      <div className={cn(
                        "text-right font-bold font-mono text-sm",
                        ('kind' in item && item.kind === 'expense') || (item as any).type === 'withdrawal' ? "text-red-600" : "text-green-600"
                      )}>
                        {('kind' in item && item.kind === 'expense') || (item as any).type === 'withdrawal' ? '-' : '+'}৳{item.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && expenses.length === 0 && incomes.length === 0 && (
                    <div className="p-12 text-center text-gray-500 font-mono text-sm uppercase">
                      No history recorded
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div 
              key="members"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-black pl-10 pr-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => setIsAddingMember(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                  >
                    <Plus size={18} />
                    New Member
                  </button>
                )}
              </div>

              <div className="bg-white border border-black overflow-hidden">
                <div className="grid grid-cols-4 p-4 border-b border-black bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  <div className="col-span-2">Member Name</div>
                  <div className="text-right">Joined</div>
                  <div className="text-right">Balance</div>
                </div>
                <div className="divide-y divide-black">
                  {filteredMembers.map((member) => (
                    <div 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      className="grid grid-cols-4 p-4 items-center hover:bg-gray-50 transition-colors group cursor-pointer"
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-xs">
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold uppercase text-sm truncate">{member.name}</p>
                            {isAdmin && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(member);
                                }}
                                className="p-1 hover:bg-black hover:text-white transition-colors border border-transparent hover:border-black"
                              >
                                <Edit size={12} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-mono text-gray-500">{member.phone || '---'}</p>
                            <span className="text-[10px] font-mono bg-gray-100 px-1 border border-black/10">
                              {member.shares || 1} Shares
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs text-gray-500">
                        {format(member.joinedAt.toDate(), 'MMM yyyy')}
                      </div>
                      <div className="text-right">
                        <p className="font-bold font-mono">৳{member.totalSavings.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div className="p-12 text-center text-gray-500 font-mono text-sm uppercase">
                      No members found
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold uppercase italic font-serif">Savings History (Income)</h2>
                {isAdmin && (
                  <button 
                    onClick={() => setIsAddingTransaction(true)}
                    className="flex items-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                  >
                    <Plus size={18} />
                    Add Transaction
                  </button>
                )}
              </div>

              <div className="bg-white border border-black overflow-hidden">
                <div className="grid grid-cols-4 p-4 border-b border-black bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  <div>Date</div>
                  <div>Member</div>
                  <div className="text-right">Type</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="divide-y divide-black">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="grid grid-cols-4 p-4 items-center hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <Calendar size={12} />
                        {format(tx.date.toDate(), 'MMM d, HH:mm')}
                      </div>
                      <div className="font-bold uppercase text-xs truncate pr-2">
                        {getMemberNameById(tx.memberId, tx.memberName)}
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-[10px] font-mono uppercase px-2 py-0.5 border",
                          tx.type === 'deposit' ? "border-green-500 text-green-600 bg-green-50" : "border-red-500 text-red-600 bg-red-50"
                        )}>
                          {tx.type}
                        </span>
                      </div>
                      <div className="text-right font-bold font-mono text-sm">
                        {tx.type === 'deposit' ? '+' : '-'}৳{tx.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="p-12 text-center text-gray-500 font-mono text-sm uppercase">
                      No transactions recorded
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'incomes' && (
            <motion.div 
              key="incomes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold uppercase italic font-serif">Income History (General)</h2>
                {isAdmin && (
                  <button 
                    onClick={() => setIsAddingIncome(true)}
                    className="flex items-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                  >
                    <Plus size={18} />
                    Add Income
                  </button>
                )}
              </div>

              <div className="bg-white border border-black overflow-hidden">
                <div className="grid grid-cols-4 p-4 border-b border-black bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  <div>Date</div>
                  <div>Source/Title</div>
                  <div className="text-right">Category</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="divide-y divide-black">
                  {incomes.map((inc) => (
                    <div key={inc.id} className="grid grid-cols-4 p-4 items-center hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <Calendar size={12} />
                        {format(inc.date.toDate(), 'MMM d, HH:mm')}
                      </div>
                      <div className="font-bold uppercase text-xs truncate pr-2">
                        {inc.title}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-black bg-gray-50">
                          {inc.category}
                        </span>
                      </div>
                      <div className="text-right font-bold font-mono text-sm text-green-600">
                        +৳{inc.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {incomes.length === 0 && (
                    <div className="p-12 text-center text-gray-500 font-mono text-sm uppercase">
                      No income records found
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'expenses' && (
            <motion.div 
              key="expenses"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold uppercase italic font-serif">Expense History (Expenditure)</h2>
                {isAdmin && (
                  <button 
                    onClick={() => setIsAddingExpense(true)}
                    className="flex items-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                  >
                    <Plus size={18} />
                    Record Expense
                  </button>
                )}
              </div>

              <div className="bg-white border border-black overflow-hidden">
                <div className="grid grid-cols-4 p-4 border-b border-black bg-gray-50 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                  <div>Date</div>
                  <div>Expense Details</div>
                  <div className="text-right">Category</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="divide-y divide-black">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="grid grid-cols-4 p-4 items-center hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <Calendar size={12} />
                        {format(exp.date.toDate(), 'MMM d, yyyy')}
                      </div>
                      <div className="font-bold uppercase text-xs truncate pr-2">
                        {exp.title}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-black bg-gray-100">
                          {exp.category}
                        </span>
                      </div>
                      <div className="text-right font-bold font-mono text-sm text-red-600">
                        ৳{exp.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {expenses.length === 0 && (
                    <div className="p-12 text-center text-gray-500 font-mono text-sm uppercase">
                      No expenses recorded
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-black p-8 w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="text-2xl font-bold uppercase italic font-serif mb-6">Register New Member</h3>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={newMember.name}
                    onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={newMember.phone}
                    onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="Enter phone"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Join Date</label>
                  <input 
                    required
                    type="date" 
                    value={newMember.joinedAt}
                    onChange={(e) => setNewMember({...newMember, joinedAt: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Number of Shares (1 Share = 100৳)</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    value={newMember.shares}
                    onChange={(e) => setNewMember({...newMember, shares: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingMember(false)}
                    className="flex-1 border border-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800"
                  >
                    Add Member
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-black p-8 w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="text-2xl font-bold uppercase italic font-serif mb-6">Record Transaction</h3>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Select Member</label>
                  <select 
                    required
                    value={newTx.memberId}
                    onChange={(e) => setNewTx({...newTx, memberId: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none appearance-none"
                  >
                    <option value="">Choose a member...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Amount (৳)</label>
                  <input 
                    required
                    type="number" 
                    value={newTx.amount}
                    onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Transaction Type</label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setNewTx({...newTx, type: 'deposit'})}
                      className={cn(
                        "flex-1 py-2 font-mono text-xs uppercase border border-black transition-all",
                        newTx.type === 'deposit' ? "bg-black text-white" : "bg-white text-black"
                      )}
                    >
                      Deposit
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewTx({...newTx, type: 'withdrawal'})}
                      className={cn(
                        "flex-1 py-2 font-mono text-xs uppercase border border-black transition-all",
                        newTx.type === 'withdrawal' ? "bg-black text-white" : "bg-white text-black"
                      )}
                    >
                      Withdrawal
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingTransaction(false)}
                    className="flex-1 border border-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingIncome && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-black p-8 w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="text-2xl font-bold uppercase italic font-serif mb-6">Add General Income</h3>
              <form onSubmit={handleAddIncome} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Income Title</label>
                  <input 
                    required
                    type="text" 
                    value={newIncome.title}
                    onChange={(e) => setNewIncome({...newIncome, title: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="e.g. Bank Interest June"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Category</label>
                  <select 
                    required
                    value={newIncome.category}
                    onChange={(e) => setNewIncome({...newIncome, category: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none appearance-none"
                  >
                    {incomeCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Amount (৳)</label>
                  <input 
                    required
                    type="number" 
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingIncome(false)}
                    className="flex-1 border border-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800"
                  >
                    Save Income
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-black p-8 w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="text-2xl font-bold uppercase italic font-serif mb-6">Record Expense</h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Expense Title</label>
                  <input 
                    required
                    type="text" 
                    value={newExpense.title}
                    onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="e.g. Annual Meeting Food"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Category</label>
                  <select 
                    required
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none appearance-none"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Amount (৳)</label>
                  <input 
                    required
                    type="number" 
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingExpense(false)}
                    className="flex-1 border border-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-black p-8 w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold uppercase italic font-serif">Edit Member</h3>
                <button onClick={() => setEditingMember(null)} className="p-1 hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateMember} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Join Date</label>
                  <input 
                    required
                    type="date" 
                    value={editForm.joinedAt}
                    onChange={(e) => setEditForm({...editForm, joinedAt: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Number of Shares (1 Share = 100৳)</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    value={editForm.shares}
                    onChange={(e) => setEditForm({...editForm, shares: e.target.value})}
                    className="w-full bg-gray-50 border border-black p-3 font-mono text-sm focus:outline-none"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="flex-1 border border-black py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-sm hover:bg-gray-800"
                  >
                    Update Info
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-black p-0 w-full max-w-2xl shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-black bg-black text-white flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold uppercase italic font-serif">{selectedMember.name}</h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest opacity-70">
                    Member Profile • {selectedMember.shares || 1} Shares (৳{(selectedMember.shares || 1) * 100}/mo)
                  </p>
                </div>
                <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-white/10 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="border border-black p-4">
                    <p className="text-[10px] font-mono uppercase text-gray-500 mb-1">Total Savings</p>
                    <p className="text-xl font-bold font-mono">৳{selectedMember.totalSavings.toLocaleString()}</p>
                  </div>
                  <div className="border border-black p-4">
                    <p className="text-[10px] font-mono uppercase text-gray-500 mb-1">Shares</p>
                    <p className="text-xl font-bold font-mono">{selectedMember.shares || 1}</p>
                  </div>
                  <div className="border border-black p-4">
                    <p className="text-[10px] font-mono uppercase text-gray-500 mb-1">Monthly Target</p>
                    <p className="text-xl font-bold font-mono">৳{(selectedMember.shares || 1) * 100}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold uppercase mb-4 border-b border-black pb-1">Monthly Contribution History</h4>
                  <div className="space-y-2">
                    {(() => {
                      const history = [];
                      const startDate = new Date(2023, 3, 1); // April 2023
                      const endDate = new Date();
                      const monthlyTarget = (selectedMember.shares || 1) * 100;
                      
                      // Calculate total deposits for this member
                      const totalDeposits = transactions
                        .filter(tx => tx.memberId === selectedMember.id && tx.type === 'deposit')
                        .reduce((sum, tx) => sum + tx.amount, 0);
                      
                      let remainingBalance = totalDeposits;
                      let current = new Date(startDate);
                      
                      // Loop through months from start until now, or as long as there's advance balance
                      while (current <= endDate || remainingBalance > 0) {
                        const monthStr = format(current, 'MMMM yyyy');
                        let paidForThisMonth = 0;
                        let status: 'Paid' | 'Partial' | 'Due' = 'Due';
                        
                        if (remainingBalance >= monthlyTarget) {
                          paidForThisMonth = monthlyTarget;
                          remainingBalance -= monthlyTarget;
                          status = 'Paid';
                        } else if (remainingBalance > 0) {
                          paidForThisMonth = remainingBalance;
                          remainingBalance = 0;
                          status = 'Partial';
                        } else {
                          paidForThisMonth = 0;
                          status = 'Due';
                        }
                        
                        const isFuture = current > endDate;
                        
                        history.push(
                          <div key={monthStr} className={cn(
                            "flex items-center justify-between p-3 border border-black transition-colors",
                            isFuture ? "bg-blue-50/30 border-dashed" : "hover:bg-gray-50"
                          )}>
                            <div className="flex flex-col">
                              <div className="font-mono text-xs uppercase">{monthStr}</div>
                              {isFuture && <span className="text-[8px] font-mono uppercase text-blue-600 font-bold">Advance</span>}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[10px] font-mono uppercase text-gray-500">Paid</p>
                                <p className="font-bold font-mono text-xs">৳{paidForThisMonth.toLocaleString()}</p>
                              </div>
                              <div className={cn(
                                "px-2 py-1 text-[10px] font-mono uppercase border min-w-[60px] text-center",
                                status === 'Paid' ? "bg-green-500 text-white border-green-600" :
                                status === 'Partial' ? "bg-yellow-400 text-black border-yellow-500" :
                                "bg-red-500 text-white border-red-600"
                              )}>
                                {status}
                              </div>
                            </div>
                          </div>
                        );
                        
                        current.setMonth(current.getMonth() + 1);
                        
                        // Safety break to prevent infinite loop if target is 0 or something goes wrong
                        if (history.length > 240) break; // Max 20 years
                      }
                      
                      return history.reverse();
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-8 text-center border-t border-black mt-12">
        <p className="text-[10px] font-mono uppercase text-gray-500 tracking-widest">
          © 2026 Razin's project • Built for Community
        </p>
      </footer>
    </div>
  );
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
