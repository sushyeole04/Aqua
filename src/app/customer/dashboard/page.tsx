'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Droplet, Home, ShoppingBag, Wallet, History, User, Bell, X, 
  Plus, Calendar, CreditCard, QrCode, Truck, CheckCircle2, Clock, 
  Award, ArrowUpRight, TrendingUp, AlertCircle, LogOut, MessageSquare, Star, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { translate, Language } from '@/utils/dictionary';
import { downloadInvoicePDF } from '@/utils/pdf-generator';
import { getSocket, connectSocket, disconnectSocket } from '@/utils/socket';

export default function CustomerDashboard() {
  const router = useRouter();

  // Application state
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [language, setLanguage] = useState<Language>('en');

  // UI state
  const [activeTab, setActiveTab] = useState<'HOME' | 'ORDERS' | 'WALLET' | 'HISTORY' | 'PROFILE'>('HOME');
  const [isLoading, setIsLoading] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isPayDuesOpen, setIsPayDuesOpen] = useState(false);
  const [rechargeAmt, setRechargeAmt] = useState('500');
  const [quickOrderModal, setQuickOrderModal] = useState(false);

  // Quick Order & Order variables
  const [quantity, setQuantity] = useState<number>(1);
  const [scheduleType, setScheduleType] = useState<'ONCE' | 'BOOKING' | 'SUBSCRIPTION'>('ONCE');
  const [deliverySchedule, setDeliverySchedule] = useState<string>('NOW');
  const [subSchedule, setSubSchedule] = useState<string>('DAILY');
  const [bookingDate, setBookingDate] = useState<string>(
    new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [bookingSlot, setBookingSlot] = useState<string>('Morning (8 AM - 11 AM)');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'COD' | 'PAY_LATER'>('UPI');
  const [checkoutStep, setCheckoutStep] = useState<'NONE' | 'PROCESSING' | 'UPI_QR' | 'SUCCESS'>('NONE');
  const [tempOrder, setTempOrder] = useState<any>(null);
  const [checkoutRefId, setCheckoutRefId] = useState<string>('');

  // Ratings variables
  const [ratingOrder, setRatingOrder] = useState<any>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  // Referral code state
  const [referralInput, setReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<string | null>(null);

  // Financial Pricing calculations
  const pricePerJar = 21.19; // Price per jar excl. GST
  const subtotal = quantity * pricePerJar;
  const cgst = subtotal * 0.09;
  const sgst = subtotal * 0.09;
  const totalAmount = subtotal + cgst + sgst;

  // Notification lists
  const unreadNotifs = notifications.filter(n => !n.isRead);

  // Fetch initial dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      // 1. Fetch current user session
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      setUser(meData.user);

      // 2. Fetch orders
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders);
      }

      // 3. Fetch ledger
      const ledgerRes = await fetch('/api/ledger');
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData.ledger);
      }

      // 4. Fetch notifications
      const notifsRes = await fetch('/api/notifications');
      if (notifsRes.ok) {
        const notifsData = await notifsRes.json();
        setNotifications(notifsData.notifications);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Set up socket listener for live order changes
  useEffect(() => {
    if (!user || !user.customerProfile) return;

    const customerId = user.customerProfile.id;
    const roomName = `customer_${customerId}`;

    // Establish WebSocket Connection
    connectSocket(roomName);
    const socket = getSocket();

    // Listen for live status change
    socket.on('order-status-change', (data: any) => {
      // Show desktop/browser native notification or toast
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Order Status Updated', {
          body: `Order #${data.orderId} is now: ${data.status}`,
          icon: '/favicon.ico'
        });
      }
      // Re-fetch data to update status instantly
      loadDashboardData();
    });

    // Request desktop notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      disconnectSocket(roomName);
    };
  }, [user, loadDashboardData]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleTriggerCheckout = () => {
    const customer = user.customerProfile;
    // Validate Pay Later credit limit
    if (paymentMethod === 'PAY_LATER') {
      const projectedDues = customer.pendingDues + totalAmount;
      if (projectedDues > customer.creditLimit) {
        alert(`Credit limit exceeded! Your current outstanding is ₹${customer.pendingDues} and this order is ₹${totalAmount.toFixed(2)}. Credit limit is ₹${customer.creditLimit}. Please pay outstanding dues first.`);
        return;
      }
    }

    setCheckoutRefId(`AQU-${Date.now().toString().slice(-6)}`);
    setCheckoutStep('PROCESSING');

    setTimeout(() => {
      if (paymentMethod === 'UPI') {
        setCheckoutStep('UPI_QR');
      } else {
        completeCheckout();
      }
    }, 1200);
  };

  const completeCheckout = async () => {
    try {
      let finalSchedule = deliverySchedule;
      if (scheduleType === 'SUBSCRIPTION') {
        finalSchedule = subSchedule;
      } else if (scheduleType === 'BOOKING') {
        finalSchedule = `Slot: ${bookingSlot}`;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          type: scheduleType,
          schedule: finalSchedule,
          paymentMethod,
          scheduledDate: scheduleType === 'BOOKING' ? bookingDate : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Trigger socket event
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('new-order', {
          orderId: data.order.id,
          customerName: user.name,
          quantity: quantity
        });
      }

      setTempOrder(data.order);
      setCheckoutStep('SUCCESS');

      // Trigger Confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 },
        colors: ['#06b6d4', '#3b82f6', '#ffffff']
      });

      // Reload profile & orders data
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to place order.');
      setCheckoutStep('NONE');
    }
  };

  const handleWalletRecharge = async () => {
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: rechargeAmt,
          method: 'UPI',
          txRef: `TXN${Math.floor(100000 + Math.random() * 900000)}`,
          type: 'WALLET'
        })
      });

      if (!res.ok) throw new Error('Recharge failed');

      alert(`Successfully recharged ₹${rechargeAmt} to wallet!`);
      setIsRechargeOpen(false);
      loadDashboardData();
    } catch (e) {
      alert('Wallet recharge failed.');
    }
  };

  const handlePayOutstanding = async () => {
    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: user.customerProfile.pendingDues,
          method: 'UPI',
          txRef: `TXN${Math.floor(100000 + Math.random() * 900000)}`,
          type: 'DUES'
        })
      });

      if (!res.ok) throw new Error('Dues payment failed');

      alert(`Successfully settled outstanding dues!`);
      setIsPayDuesOpen(false);
      loadDashboardData();
    } catch (e) {
      alert('Outstanding dues payment failed.');
    }
  };

  const handleRedeemLoyalty = async () => {
    if (user.customerProfile.loyaltyPoints < 100) return;
    try {
      // Place a free order
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: 1,
          type: 'ONCE',
          paymentMethod: 'UPI', // will show paid and charge 0
          scheduledDate: new Date()
        })
      });

      if (!res.ok) throw new Error('Redemption failed');

      // Deduct loyalty points manually in client or let db handle it
      // Our API route automatically adds 10 points when placing order, but doesn't handle the subtraction.
      // So we update user profile to deduct 100 points
      await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.customerProfile.id,
          loyaltyPoints: user.customerProfile.loyaltyPoints - 100
        })
      });

      alert('Redeemed 100 points for a FREE Water Jar! Order placed successfully.');
      loadDashboardData();
    } catch (e) {
      alert('Failed to redeem points.');
    }
  };

  const handleDownloadInvoice = (order: any) => {
    const pricePerJar = 21.19;
    const subtotal = order.quantity * pricePerJar;
    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const total = order.totalAmount;

    downloadInvoicePDF({
      invoiceNum: `INV-2026-${order.id.split('-')[0]}`,
      customerName: user.name,
      customerPhone: user.phone,
      customerAddress: user.customerProfile.address,
      customerQrId: user.customerProfile.qrCodeId,
      date: new Date(order.createdAt).toISOString().split('T')[0],
      dueDate: new Date(new Date(order.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantity: order.quantity,
      unitPrice: pricePerJar,
      subtotal,
      cgst,
      sgst,
      total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus
    });
  };

  const handleMarkNotifRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      loadDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyReferral = () => {
    if (referralInput.toUpperCase().startsWith('AQUA') && referralInput.length >= 6) {
      // Simulate reward
      fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50.0,
          method: 'UPI',
          txRef: 'REFERRAL-CREDIT',
          type: 'WALLET'
        })
      }).then(() => {
        setReferralStatus('Success! ₹50 credited.');
        setReferralInput('');
        loadDashboardData();
      });
    } else {
      setReferralStatus('Invalid referral code format.');
    }
  };

  // Timeline Helper
  const getActiveTimelineOrder = () => {
    return orders.find(o => ['RECEIVED', 'ACCEPTED', 'OUT_FOR_DELIVERY'].includes(o.status));
  };

  // Rendering Helper
  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-6">
        <div className="w-full max-w-[340px] space-y-6">
          <div className="h-10 bg-slate-900/60 rounded-xl animate-pulse w-2/3"></div>
          <div className="h-32 bg-slate-900/60 rounded-2xl animate-pulse"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 bg-slate-900/60 rounded-2xl animate-pulse"></div>
            <div className="h-28 bg-slate-900/60 rounded-2xl animate-pulse"></div>
          </div>
          <div className="h-48 bg-slate-900/60 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Compute running balance for jar ledger history
  const getJarLedgerHistory = () => {
    const txns = user?.customerProfile?.jarTransactions || [];
    // Sort chronological (oldest first) to calculate running balance
    const sorted = [...txns].sort((a: any, b: any) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let runningBalance = 0;
    const history = sorted.map((txn: any) => {
      const isDel = txn.type === 'DELIVERY';
      const delivered = isDel ? txn.quantity : 0;
      const collected = !isDel ? txn.quantity : 0;
      runningBalance = runningBalance + delivered - collected;

      return {
        id: txn.id,
        date: new Date(txn.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' }),
        delivered,
        collected,
        balance: runningBalance
      };
    });

    // Return reversed (newest first) to display on top
    return history.reverse();
  };

  const customer = user.customerProfile;
  const activeTimelineOrder = getActiveTimelineOrder();

  return (
    <div className="min-h-screen flex flex-col bg-[#050b18] text-slate-100 pb-20 md:pb-0">
      
      {/* Top Header Bar */}
      <header className="h-16 shrink-0 border-b border-sky-500/10 bg-[#070f23]/80 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center glow-aqua">
            <Droplet className="h-5 w-5 text-white fill-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide uppercase">Chhatrapati Aqua</h1>
            <p className="text-[9px] text-slate-400 font-semibold tracking-wider">Customer Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick language toggle */}
          <div className="flex gap-1 bg-slate-900/40 border border-slate-800 rounded-lg p-1 text-[9px] font-bold">
            <button onClick={() => setLanguage('en')} className={`px-2 py-0.5 rounded ${language==='en'?'bg-cyan-950 text-cyan-400':''}`}>EN</button>
            <button onClick={() => setLanguage('hi')} className={`px-2 py-0.5 rounded ${language==='hi'?'bg-cyan-950 text-cyan-400':''}`}>HI</button>
            <button onClick={() => setLanguage('mr')} className={`px-2 py-0.5 rounded ${language==='mr'?'bg-cyan-950 text-cyan-400':''}`}>MR</button>
          </div>

          <button
            onClick={() => setIsNotifOpen(true)}
            className="p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800 relative"
          >
            <Bell className="h-4.5 w-4.5 text-slate-300" />
            {unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                {unreadNotifs.length}
              </span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-rose-950/15 hover:bg-rose-900/20 border border-rose-900/20 text-rose-450 text-xs font-bold transition-all"
            title="Log Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid (Desktop Layout Sidebar, Mobile fullwidth scroll) */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative max-w-6xl mx-auto w-full">
        
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex w-56 bg-[#070f23]/40 border-r border-slate-900/80 p-4 flex-col justify-between shrink-0">
          <nav className="space-y-1">
            {[
              { key: 'HOME' as const, label: 'Home', icon: Home },
              { key: 'ORDERS' as const, label: 'Quick Order', icon: ShoppingBag },
              { key: 'WALLET' as const, label: 'Credit & Wallet', icon: Wallet },
              { key: 'HISTORY' as const, label: 'Order History', icon: History },
              { key: 'PROFILE' as const, label: 'Profile Settings', icon: User }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full py-3 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${
                    isActive 
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{translate(language, tab.label.toLowerCase() as any)}</span>
                </button>
              );
            })}
          </nav>

          <div className="bg-slate-950/30 p-3.5 rounded-2xl border border-slate-900 text-center">
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Account Active</span>
            <span className="text-[10px] text-cyan-400 font-bold mt-1 inline-flex items-center gap-1 bg-cyan-950/30 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              {customer.qrCodeId}
            </span>
          </div>
        </aside>

        {/* Scrollable Main Content Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar min-h-0 bg-[#060c1c]">
          <div className="max-w-md mx-auto md:max-w-none space-y-6">

            {/* Render views depending on tab */}
            {activeTab === 'HOME' && (
              <div className="space-y-6 pb-6">
                
                {/* Welcome Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/30 via-cyan-500/20 to-transparent p-5 border border-sky-500/20 glass-card">
                  <div className="absolute right-4 top-4 opacity-15">
                    <Droplet className="h-24 w-24 text-cyan-400 fill-cyan-400 animate-pulse" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    {translate(language, 'tagline')}
                  </span>
                  <h2 className="text-2xl font-extrabold text-white mt-1 capitalize">
                    {translate(language, 'welcome')}, {user.name}!
                  </h2>
                  <p className="text-xs text-slate-350 mt-2 truncate">
                    📍 {customer.address}
                  </p>
                </div>

                {/* Dashboard Widgets grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Outstanding Dues */}
                  <div className="col-span-2 glass-card rounded-2xl p-4 border border-rose-500/15 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl"></div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{translate(language, 'pendingAmount')}</span>
                      <h3 className="text-2xl font-black text-rose-400 mt-1">₹{customer.pendingDues}</h3>
                      <span className="text-[9px] text-slate-500 font-semibold">Due Date: 5th of next month</span>
                    </div>
                    {customer.pendingDues > 0 && (
                      <button
                        onClick={() => setIsPayDuesOpen(true)}
                        className="py-2 px-4 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.97]"
                      >
                        Pay Now
                      </button>
                    )}
                  </div>

                  {/* Outstanding Empty Jars */}
                  <div className="col-span-2 glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-slate-500/5 rounded-full blur-xl"></div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Outstanding Empty Jars</span>
                      <h3 className={`text-xl font-black mt-1 flex items-center gap-1.5 ${
                        (customer.jarLedger?.balance || 0) === 0 ? 'text-emerald-450' :
                        (customer.jarLedger?.balance || 0) <= 5 ? 'text-amber-400' : 'text-rose-455'
                      }`}>
                        🫙 {(customer.jarLedger?.balance || 0)} Jars With Customer
                      </h3>
                      <p className="text-[9px] text-slate-500 font-semibold">
                        Empty jars pending for return.
                      </p>
                    </div>
                    {customer.securityDeposit > 0 && (
                      <div className="text-right">
                        <span className="text-[9px] bg-slate-900 border border-slate-850 px-2 py-1 rounded text-slate-400 font-extrabold block">
                          Hold: ₹{customer.securityDeposit || 0}
                        </span>
                        <span className="text-[8px] text-slate-500 font-medium block mt-1">₹200 deposit/jar</span>
                      </div>
                    )}
                  </div>

                  {/* Active Subscription Status */}
                  <div className="col-span-1 glass-card rounded-2xl p-4 border border-cyan-500/10 flex flex-col justify-between h-28 relative overflow-hidden">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Subscription Status</span>
                    <div>
                      <h3 className={`text-sm font-extrabold mt-1 ${customer.subStatus === 'ACTIVE' ? 'text-cyan-400' : 'text-slate-400'}`}>
                        {customer.subStatus === 'ACTIVE' ? 'Active Plan' : 'No Active Plan'}
                      </h3>
                      <p className="text-[9px] text-slate-500 font-medium">
                        {customer.subStatus === 'ACTIVE' ? `${customer.subQuantity} Jars / ${customer.subSchedule}` : 'Configure monthly sub'}
                      </p>
                    </div>
                  </div>

                  {/* Loyalty Reward Points */}
                  <div className="col-span-1 glass-card rounded-2xl p-4 border border-blue-500/10 flex flex-col justify-between h-28 relative overflow-hidden">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{translate(language, 'loyaltyPoints')}</span>
                    <div>
                      <h3 className="text-base font-extrabold text-cyan-300 mt-1 flex items-center gap-1">
                        <Award className="h-4.5 w-4.5 text-amber-400" />
                        {customer.loyaltyPoints} PTS
                      </h3>
                      {customer.loyaltyPoints >= 100 ? (
                        <button
                          onClick={handleRedeemLoyalty}
                          className="mt-1 text-[8.5px] bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-900 border border-cyan-500/20 px-2 py-0.5 rounded font-extrabold transition-all"
                        >
                          Redeem Free Jar
                        </button>
                      ) : (
                        <p className="text-[8.5px] text-slate-500">{100 - (customer.loyaltyPoints % 100)} pts until free jar</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Returnable Jar Ledger statement table */}
                <div className="glass-card rounded-2xl p-4 border border-slate-850 space-y-3.5">
                  <h4 className="text-xs font-bold text-slate-200 block uppercase tracking-wider flex items-center gap-1.5">
                    <span>🫙</span> Returnable Jar Ledger Statement
                  </h4>
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-[10px] text-slate-350 text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 font-bold">
                          <th className="py-2 px-1">Date</th>
                          <th className="py-2 px-1 text-right">Delivered</th>
                          <th className="py-2 px-1 text-right">Collected</th>
                          <th className="py-2 px-1 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getJarLedgerHistory().map((item: any) => (
                          <tr key={item.id} className="border-b border-slate-950/40 hover:bg-slate-950/10">
                            <td className="py-2 px-1 font-mono text-slate-455 whitespace-nowrap">{item.date}</td>
                            <td className="py-2 px-1 text-right font-extrabold text-cyan-400">{item.delivered || '-'}</td>
                            <td className="py-2 px-1 text-right font-extrabold text-emerald-450">{item.collected || '-'}</td>
                            <td className="py-2 px-1 text-right font-black text-white">{item.balance}</td>
                          </tr>
                        ))}
                        {getJarLedgerHistory().length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-slate-500 italic">
                              No returnable empty jars tracked yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TIMELINE TRACKING WIDGET */}
                {activeTimelineOrder && (
                  <div className="glass-card rounded-2xl p-5 border border-cyan-500/15 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4.5 w-4.5 text-cyan-400 animate-pulse" />
                        <h4 className="text-xs font-bold text-slate-200">Active Delivery Tracking</h4>
                      </div>
                      <span className="text-[9px] font-mono text-cyan-400 font-bold px-2 py-0.5 rounded-full bg-cyan-950/40 border border-cyan-900/30">
                        {activeTimelineOrder.id}
                      </span>
                    </div>

                    {/* Timeline Graphical Stepper */}
                    <div className="relative pl-6 space-y-5 border-l-2 border-slate-800">
                      {/* Received */}
                      <div className="relative">
                        <div className={`absolute -left-[30px] top-0 h-4 w-4 rounded-full flex items-center justify-center ${
                          ['RECEIVED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeTimelineOrder.status)
                            ? 'bg-cyan-500 text-white' : 'bg-slate-800'
                        }`}>
                          <Clock className="h-2.5 w-2.5" />
                        </div>
                        <h5 className="text-[11px] font-bold text-slate-200">Order Received</h5>
                        <p className="text-[9px] text-slate-400 mt-0.5">Order placed via App.</p>
                      </div>

                      {/* Accepted */}
                      <div className="relative">
                        <div className={`absolute -left-[30px] top-0 h-4 w-4 rounded-full flex items-center justify-center ${
                          ['ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeTimelineOrder.status)
                            ? 'bg-cyan-500 text-white' : 'bg-slate-800'
                        }`}>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        </div>
                        <h5 className="text-[11px] font-bold text-slate-200">Accepted & Processing</h5>
                        <p className="text-[9px] text-slate-400 mt-0.5">Inventory reserves allocated at Hub.</p>
                      </div>

                      {/* Out For Delivery */}
                      <div className="relative">
                        <div className={`absolute -left-[30px] top-0 h-4 w-4 rounded-full flex items-center justify-center ${
                          ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(activeTimelineOrder.status)
                            ? 'bg-cyan-500 text-white' : 'bg-slate-800'
                        }`}>
                          <Truck className="h-2.5 w-2.5 animate-bounce" />
                        </div>
                        <h5 className="text-[11px] font-bold text-slate-200">Out for Delivery</h5>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          Driver {activeTimelineOrder.delivery?.driverId ? 'Sandeep Patil' : 'dispatching'} is en-route.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Orders log */}
                <div className="glass-card rounded-2xl p-5 border border-slate-850 space-y-4">
                  <h4 className="text-xs font-bold text-slate-200 block uppercase tracking-wider">Recent Deliveries</h4>
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((o) => (
                      <div key={o.id} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex justify-between items-center">
                        <div>
                          <h5 className="text-xs font-bold text-slate-300">{o.quantity} Jars ({o.type})</h5>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5">{new Date(o.createdAt).toLocaleDateString()} | #{o.id.split('-')[0]}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[8.5px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block ${
                            o.status === 'DELIVERED' ? 'bg-emerald-950/45 text-emerald-400 border border-emerald-900/20' : 
                            o.status === 'CANCELLED' ? 'bg-rose-950/45 text-rose-400 border border-rose-900/20' : 
                            'bg-cyan-950/45 text-cyan-400 border border-cyan-900/20'
                          }`}>
                            {o.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 block mt-1">₹{o.totalAmount}</span>
                        </div>
                      </div>
                    ))}
                    {orders.length === 0 && (
                      <p className="text-center py-6 text-xs text-slate-500">No recent orders.</p>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ORDER TAB */}
            {activeTab === 'ORDERS' && (
              <div className="space-y-6 pb-20 md:pb-6">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-cyan-400" />
                  {translate(language, 'quickOrder')}
                </h3>

                {/* Custom Quantity Stepper */}
                <div className="space-y-3">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                    {translate(language, 'jars20l')} (₹25.00 / jar)
                  </label>
                  <div className="glass-card rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-bold">Select Quantity</span>
                    <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-xl px-2 py-1">
                      <button
                        type="button"
                        onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                        className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-750 text-slate-350 hover:text-white hover:border-slate-600 transition-all flex items-center justify-center font-black text-base"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          if (!isNaN(parsed) && parsed > 0) setQuantity(parsed);
                        }}
                        min="1"
                        className="w-14 bg-transparent border-0 text-center font-extrabold text-sm text-cyan-400 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(prev => prev + 1)}
                        className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-750 text-slate-355 hover:text-white hover:border-slate-600 transition-all flex items-center justify-center font-black text-base"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Schedule Type Selection */}
                <div className="space-y-3">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                    {translate(language, 'scheduleDelivery')}
                  </label>
                  <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800/60">
                    <button
                      onClick={() => setScheduleType('ONCE')}
                      className={`flex-grow py-2 rounded-lg text-[10px] font-semibold transition-all ${
                        scheduleType === 'ONCE' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {translate(language, 'deliverNow')}
                    </button>
                    <button
                      onClick={() => setScheduleType('BOOKING')}
                      className={`flex-grow py-2 rounded-lg text-[10px] font-semibold transition-all ${
                        scheduleType === 'BOOKING' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Pre-Book
                    </button>
                    <button
                      onClick={() => setScheduleType('SUBSCRIPTION')}
                      className={`flex-grow py-2 rounded-lg text-[10px] font-semibold transition-all ${
                        scheduleType === 'SUBSCRIPTION' ? 'bg-cyan-500 text-white shadow animate-water-pulse' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sub Plans
                    </button>
                  </div>

                  {/* Scheduler sub configurations */}
                  <AnimatePresence mode="wait">
                    {scheduleType === 'ONCE' ? (
                      <motion.div
                        key="once"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="bg-slate-900/20 border border-slate-800/60 rounded-xl p-3.5 space-y-3 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Order Timing</span>
                          <span className="text-cyan-400 font-bold">Deliver in 45 mins</span>
                        </div>
                        <div className="flex gap-2">
                          {['NOW', 'EVENING'].map((sched) => (
                            <button
                              key={sched}
                              onClick={() => setDeliverySchedule(sched)}
                              className={`flex-1 py-2 border rounded-lg text-[10px] font-bold transition-all ${
                                deliverySchedule === sched ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400' : 'border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {sched === 'NOW' ? 'Immediate Dispatch' : 'Evening (5 PM - 8 PM)'}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ) : scheduleType === 'BOOKING' ? (
                      <motion.div
                        key="booking"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="bg-cyan-950/5 border border-cyan-500/20 rounded-xl p-3.5 space-y-3"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Choose Date</span>
                          <input
                            type="date"
                            value={bookingDate}
                            min={new Date(new Date().getTime() + 24*60*60*1000).toISOString().split('T')[0]}
                            onChange={(e) => setBookingDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Select Time Slot</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {['Morning (8 AM - 11 AM)', 'Noon (11 AM - 2 PM)', 'Afternoon (2 PM - 5 PM)', 'Evening (5 PM - 8 PM)'].map(slot => (
                              <button
                                key={slot}
                                onClick={() => setBookingSlot(slot)}
                                className={`p-2 border rounded-lg text-[9px] font-bold text-left truncate transition-all ${
                                  bookingSlot === slot ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400' : 'border-slate-800 text-slate-450 hover:border-slate-750'
                                }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="sub"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="bg-sky-950/10 border border-sky-500/20 rounded-xl p-4 space-y-3"
                      >
                        <p className="text-[11px] text-slate-350 leading-relaxed">
                          {translate(language, 'subDesc')}
                        </p>
                        <div className="flex gap-2">
                          {['DAILY', 'ALTER_DAYS'].map((sched) => (
                            <button
                              key={sched}
                              onClick={() => setSubSchedule(sched)}
                              className={`flex-1 py-2 border rounded-lg text-[10px] font-bold transition-all ${
                                subSchedule === sched ? 'border-cyan-500 bg-cyan-950/20 text-cyan-400' : 'border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              {sched === 'DAILY' ? 'Every Day' : 'Alternate Days (M-W-F)'}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Payment Selection */}
                <div className="space-y-3">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                    {translate(language, 'paymentMethods')}
                  </label>
                  <div className="space-y-2.5">
                    {/* UPI */}
                    <div
                      onClick={() => setPaymentMethod('UPI')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        paymentMethod === 'UPI' ? 'bg-cyan-950/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-900/30 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <QrCode className="h-5 w-5 text-cyan-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-200">{translate(language, 'upiQR')}</p>
                          <p className="text-[9px] text-slate-500">Scan QR Code or Pay via UPI apps</p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === 'UPI' ? 'border-cyan-400' : 'border-slate-700'}`}>
                        {paymentMethod === 'UPI' && <div className="h-2 w-2 rounded-full bg-cyan-400"></div>}
                      </div>
                    </div>

                    {/* COD */}
                    <div
                      onClick={() => setPaymentMethod('COD')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        paymentMethod === 'COD' ? 'bg-cyan-950/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-900/30 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5 text-cyan-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-200">{translate(language, 'cod')}</p>
                          <p className="text-[9px] text-slate-500">Pay cash or scan QR on delivery</p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === 'COD' ? 'border-cyan-400' : 'border-slate-700'}`}>
                        {paymentMethod === 'COD' && <div className="h-2 w-2 rounded-full bg-cyan-400"></div>}
                      </div>
                    </div>

                    {/* Credit Wallet (Pay Later) */}
                    <div
                      onClick={() => setPaymentMethod('PAY_LATER')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        paymentMethod === 'PAY_LATER' ? 'bg-cyan-950/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-900/30 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-cyan-400" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-200">{translate(language, 'payLater')}</p>
                            <span className="text-[8px] bg-cyan-500/10 border border-cyan-400/20 px-1 py-0.2 rounded font-semibold text-cyan-450">CREDIT</span>
                          </div>
                          <p className="text-[9px] text-slate-500">
                            Current Dues: ₹{customer.pendingDues} / Credit Limit: ₹{customer.creditLimit}
                          </p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === 'PAY_LATER' ? 'border-cyan-400' : 'border-slate-700'}`}>
                        {paymentMethod === 'PAY_LATER' && <div className="h-2 w-2 rounded-full bg-cyan-400"></div>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkout pricing receipt */}
                <div className="glass-card rounded-2xl p-4 border border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal ({quantity} jars)</span>
                    <span className="text-slate-200">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CGST (9%)</span>
                    <span className="text-slate-200">₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SGST (9%)</span>
                    <span className="text-slate-200">₹{sgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-900 font-bold text-sm">
                    <span className="text-slate-100">Total Payable</span>
                    <span className="text-cyan-400">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Confirm order CTA button */}
                <button
                  onClick={handleTriggerCheckout}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl text-slate-100 font-extrabold text-sm shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 glow-aqua"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Confirm Delivery Order (₹{totalAmount.toFixed(2)})
                </button>
              </div>
            )}

            {/* WALLET & LEDGER TAB */}
            {activeTab === 'WALLET' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-cyan-400" />
                    Credit Wallet & Dues Ledger
                  </h3>
                </div>

                {/* Financial Balance Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card rounded-2xl p-4 border border-rose-500/10 flex flex-col justify-between h-24">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Outstanding Dues</span>
                    <div>
                      <h4 className="text-xl font-black text-rose-400">₹{customer.pendingDues}</h4>
                      <p className="text-[9px] text-slate-500 font-semibold">Limit: ₹{customer.creditLimit}</p>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-emerald-500/10 flex flex-col justify-between h-24">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Prepaid Wallet</span>
                    <div>
                      <h4 className="text-xl font-black text-emerald-400">₹{customer.walletBalance}</h4>
                      <button
                        onClick={() => setIsRechargeOpen(true)}
                        className="text-[8.5px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 font-bold px-2 py-0.5 rounded transition-all mt-1 inline-block"
                      >
                        + Add Funds
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ledger Listing */}
                <div className="glass-card rounded-2xl p-5 border border-slate-850 space-y-4">
                  <h4 className="text-xs font-bold text-slate-200 block uppercase tracking-wider">Statement Ledger Accounts</h4>
                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                    {ledger.map((entry) => (
                      <div key={entry.id} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className={`text-[8px] font-black px-1.5 py-0.2 rounded inline-block mb-1 ${
                            entry.type === 'CREDIT' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-450'
                          }`}>
                            {entry.type}
                          </span>
                          <h5 className="font-bold text-slate-300">{entry.description}</h5>
                          <p className="text-[9px] text-slate-500 font-mono mt-0.5">{entry.date}</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${entry.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {entry.type === 'CREDIT' ? '-' : '+'}₹{entry.amount}
                          </span>
                          <span className="text-[8px] text-slate-500 block font-mono mt-0.5">Bal: ₹{entry.balance}</span>
                        </div>
                      </div>
                    ))}
                    {ledger.length === 0 && (
                      <p className="text-center py-6 text-xs text-slate-500">No transaction ledger statements found.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <History className="h-5 w-5 text-cyan-400" />
                  Order History & Tax Invoices
                </h3>

                <div className="space-y-4">
                  {orders.map((o) => (
                    <div key={o.id} className="glass-card rounded-2xl p-4 border border-slate-850 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-extrabold text-white">{o.quantity} Jars 20L</h4>
                          <span className="text-[9px] text-slate-500 font-mono">ID: #{o.id.split('-')[0]} | {new Date(o.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full ${
                          o.status === 'DELIVERED' ? 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/10' : 
                          o.status === 'CANCELLED' ? 'bg-rose-950/40 text-rose-450 border border-rose-900/10' : 
                          'bg-cyan-950/40 text-cyan-400 border border-cyan-900/10'
                        }`}>
                          {o.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-900">
                        <div>
                          <span className="text-slate-500 font-semibold block">Total Amount Paid</span>
                          <span className="text-slate-350 font-bold">₹{o.totalAmount} via <span className="text-cyan-400">{o.paymentMethod}</span></span>
                        </div>

                        <div className="flex gap-2">
                          {/* Rate Order Trigger */}
                          {o.status === 'DELIVERED' && !o.delivery?.rating && (
                            <button
                              onClick={() => setRatingOrder(o)}
                              className="py-1.5 px-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-bold text-[10px] rounded-lg transition-all"
                            >
                              Rate Delivery
                            </button>
                          )}

                          {/* Download Invoice */}
                          {o.status === 'DELIVERED' && (
                            <button
                              onClick={() => handleDownloadInvoice(o)}
                              className="py-1.5 px-3 bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-900 border border-cyan-500/25 text-cyan-400 font-bold text-[10px] rounded-lg flex items-center gap-1 transition-all"
                            >
                              <Download className="h-3 w-3" />
                              Tax Invoice
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <p className="text-center py-12 text-xs text-slate-500">No order statements generated yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE TAB */}
            {activeTab === 'PROFILE' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <User className="h-5 w-5 text-cyan-400" />
                  Customer Profile & Details
                </h3>

                {/* Profile detail card */}
                <div className="glass-card rounded-2xl p-5 border border-slate-850 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white font-black text-xl">
                      {user.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white capitalize">{user.name}</h4>
                      <p className="text-xs text-slate-450 font-semibold">{user.phone} | {user.email || 'no email'}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Billed Address:</span>
                      <span className="text-slate-300 font-bold text-right max-w-[200px] truncate">{customer.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Credit limit:</span>
                      <span className="text-slate-300 font-bold">₹{customer.creditLimit}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Floating Quick Order Action Button (Required UI Improvement) */}
      {activeTab !== 'ORDERS' && (
        <button
          onClick={() => {
            setQuantity(1);
            setScheduleType('ONCE');
            setPaymentMethod('UPI');
            setQuickOrderModal(true);
          }}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-12 w-12 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 text-slate-100 flex items-center justify-center shadow-2xl z-40 hover:scale-110 active:scale-95 transition-all glow-aqua animate-water-pulse border border-sky-400/20"
          title="Place Quick Order"
        >
          <Plus className="h-6 w-6 stroke-[3px]" />
        </button>
      )}

      {/* Bottom Phone Bar Nav (Required UI Improvement) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-slate-900 bg-slate-950/80 backdrop-blur-md px-3 flex items-center justify-between z-40 select-none">
        {[
          { key: 'HOME' as const, label: 'Home', icon: Home },
          { key: 'ORDERS' as const, label: 'Orders', icon: ShoppingBag },
          { key: 'WALLET' as const, label: 'Wallet', icon: Wallet },
          { key: 'HISTORY' as const, label: 'History', icon: History },
          { key: 'PROFILE' as const, label: 'Profile', icon: User }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                isActive ? 'text-cyan-400' : 'text-slate-550 hover:text-slate-350'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'scale-110 drop-shadow-[0_0_6px_rgba(6,182,212,0.2)]' : ''}`} />
              <span className="text-[8px] font-bold mt-1 tracking-wider uppercase">
                {translate(language, tab.label.toLowerCase() as any)}
              </span>
            </button>
          );
        })}
      </nav>

      {/* OVERLAY MODALS & DRAWER SLIDES */}
      <AnimatePresence>
        
        {/* API Notifications Center Tray Drawer */}
        {isNotifOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end"
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="bg-slate-900 border-l border-slate-800 w-full max-w-[360px] h-full flex flex-col justify-between"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="h-4.5 w-4.5 text-cyan-400" />
                  Notifications Log
                </h4>
                <button
                  onClick={() => setIsNotifOpen(false)}
                  className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {notifications.length === 0 ? (
                  <p className="text-center py-12 text-xs text-slate-500">No active alerts found.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-xl border relative ${
                        n.isRead ? 'bg-slate-950/20 border-slate-850 opacity-60' : 'bg-[#09142e] border-cyan-500/20 shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="px-1.5 py-0.2 rounded text-[7px] font-bold bg-blue-950 text-blue-400">
                          {n.type}
                        </span>
                        <span className="text-[8px] text-slate-500 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-200 mt-2">{n.title}</h5>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                      
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkNotifRead(n.id)}
                          className="absolute bottom-3.5 right-3.5 text-[8.5px] font-bold text-cyan-400 hover:text-cyan-300"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Recharge Wallet Modal */}
        {isRechargeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Add Funds to Prepaid Wallet</h4>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Enter Amount (₹)</label>
                <input
                  type="number"
                  value={rechargeAmt}
                  onChange={(e) => setRechargeAmt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-650 focus:outline-none"
                />
              </div>
              <button
                onClick={handleWalletRecharge}
                className="w-full py-2.5 bg-cyan-500 text-white rounded-xl text-xs font-bold glow-aqua transition-all hover:opacity-95"
              >
                Proceed with UPI payment
              </button>
              <button
                onClick={() => setIsRechargeOpen(false)}
                className="w-full py-2.5 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Pay Outstanding Dues Modal */}
        {isPayDuesOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Pay Outstanding Balance</h4>
              <p className="text-xs text-slate-450">You are about to pay the full outstanding balance of <span className="text-white font-bold">₹{customer.pendingDues}</span>.</p>
              <button
                onClick={handlePayOutstanding}
                className="w-full py-2.5 bg-cyan-500 text-white rounded-xl text-xs font-bold glow-aqua transition-all hover:opacity-95"
              >
                Pay via UPI App
              </button>
              <button
                onClick={() => setIsPayDuesOpen(false)}
                className="w-full py-2.5 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Rating Delivery Feedback Modal */}
        {ratingOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4 text-center">
              <h4 className="text-sm font-bold text-white">Rate Delivery Service</h4>
              <p className="text-[10px] text-slate-400">Order #{ratingOrder.id.split('-')[0]} successfully delivered.</p>
              
              {/* Star Rating select */}
              <div className="flex gap-1.5 justify-center py-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    className="p-1"
                  >
                    <Star className={`h-6 w-6 transition-all ${
                      star <= selectedRating ? 'text-amber-400 fill-amber-400 scale-110' : 'text-slate-600'
                    }`} />
                  </button>
                ))}
              </div>

              <textarea
                placeholder="Write optional review feedback..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none resize-none"
              />

              <button
                onClick={async () => {
                  try {
                    // Update rating in database
                    // (Simplifying: PUT to order status route allows updating status/details)
                    await fetch(`/api/orders/${ratingOrder.id}/status`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      // We act as admin updating delivery feedback since client database schema permits
                      body: JSON.stringify({
                        status: 'DELIVERED', // keep same
                        rating: selectedRating,
                        feedback: feedbackText
                      })
                    });
                    alert('Feedback recorded. Thank you!');
                    setRatingOrder(null);
                    loadDashboardData();
                  } catch (e) {
                    setRatingOrder(null);
                  }
                }}
                className="w-full py-2.5 bg-cyan-500 text-white rounded-xl text-xs font-bold glow-aqua transition-all"
              >
                Submit Feedback
              </button>
            </div>
          </motion.div>
        )}

        {/* Floating Quick Order modal */}
        {quickOrderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[340px] p-5 space-y-4 relative">
              <button
                onClick={() => setQuickOrderModal(false)}
                className="absolute top-4 right-4 p-1 rounded-full bg-slate-800 text-slate-450 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
              
              <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Droplet className="h-4.5 w-4.5 text-cyan-400" />
                Quick Water Delivery
              </h4>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-850">
                  <span className="text-xs text-slate-400 font-bold">20L Purified Jar</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(p => Math.max(1, p - 1))}
                      className="h-7 w-7 bg-slate-900 rounded border border-slate-800 text-slate-300 font-black text-xs"
                    >
                      -
                    </button>
                    <span className="text-xs font-black text-cyan-400 w-6 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(p => p + 1)}
                      className="h-7 w-7 bg-slate-900 rounded border border-slate-800 text-slate-300 font-black text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Payment:</span>
                  <div className="flex gap-1.5">
                    {['UPI', 'PAY_LATER'].map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m as any)}
                        className={`px-2.5 py-1 border rounded-lg text-[9px] font-bold ${
                          paymentMethod === m ? 'border-cyan-500 text-cyan-400 bg-cyan-950/15' : 'border-slate-800 text-slate-500'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-350">Total Payable:</span>
                  <span className="text-cyan-400 text-sm">₹{totalAmount.toFixed(2)}</span>
                </div>

                <button
                  onClick={() => {
                    setQuickOrderModal(false);
                    handleTriggerCheckout();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold text-xs rounded-xl shadow-md glow-aqua"
                >
                  Deliver Now (₹{totalAmount.toFixed(2)})
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* PROCESSING & CHECKOUT SIMULATION POPUPS */}
        {checkoutStep === 'PROCESSING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative w-16 h-16 rounded-full border-4 border-cyan-800 flex items-center justify-center overflow-hidden mb-4">
              <div className="absolute inset-0 bg-cyan-500/10 animate-water-pulse"></div>
              <Droplet className="h-8 w-8 text-cyan-400 animate-bounce fill-cyan-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-0.5">Contacting Hub Server</h4>
            <p className="text-[10px] text-slate-450">Securing secure connection parameters...</p>
          </motion.div>
        )}

        {checkoutStep === 'UPI_QR' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 text-center relative overflow-hidden">
              <button
                onClick={() => setCheckoutStep('NONE')}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-850 text-slate-450 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
              <h4 className="text-xs font-bold text-white mb-0.5">UPI QR Checkout</h4>
              <p className="text-[9px] text-cyan-400 font-semibold mb-4">Merchant: Chhatrapati AquaSuppliers</p>
              
              <div className="bg-white p-3 rounded-2xl inline-block mb-4">
                <div className="w-36 h-36 bg-slate-100 flex items-center justify-center relative border border-slate-200">
                  <div className="absolute inset-2 border border-slate-800 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-cyan-500 absolute animate-[bounce_2s_infinite]"></div>
                    <QrCode className="h-28 w-28 text-slate-850" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 text-xs mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-450">Payable:</span>
                  <span className="font-bold text-white">₹{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Ref ID:</span>
                  <span className="text-slate-500 font-mono text-[9px]">{checkoutRefId}</span>
                </div>
              </div>

              <button
                onClick={completeCheckout}
                className="w-full py-3 bg-cyan-500 text-white rounded-xl text-xs font-extrabold glow-aqua transition-all active:scale-[0.98]"
              >
                Simulate QR Scan Success
              </button>
            </div>
          </motion.div>
        )}

        {checkoutStep === 'SUCCESS' && tempOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-cyan-500/20 rounded-3xl w-full max-w-[320px] p-6 text-center relative overflow-hidden">
              <div className="w-14 h-14 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
                <CheckCircle2 className="h-7 w-7 animate-bounce" />
              </div>
              <h4 className="text-base font-extrabold text-white">Delivery Dispatching!</h4>
              <p className="text-[10px] text-slate-400 mt-1">Order Ref: <span className="text-cyan-400 font-bold font-mono">{tempOrder.id.split('-')[0]}</span></p>

              <div className="bg-slate-950/50 rounded-xl p-4 my-5 text-left text-xs space-y-2 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Water Volume:</span>
                  <span className="text-white font-bold">{tempOrder.quantity} Jars (20L)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="text-cyan-400 font-bold">{tempOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-800 font-bold">
                  <span className="text-slate-300">Amount Paid:</span>
                  <span className="text-white">₹{tempOrder.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => setCheckoutStep('NONE')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-350 rounded-xl text-xs font-bold transition-all"
              >
                Track Live Status
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
