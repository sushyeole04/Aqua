'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Droplet, LayoutDashboard, ClipboardList, Users, DollarSign, Archive, FileText,
  Bell, X, LogOut, CheckCircle2, XCircle, Truck, User, Star, Plus, Minus, AlertCircle, TrendingUp, Download, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { downloadInvoicePDF } from '@/utils/pdf-generator';
import { getSocket, connectSocket, disconnectSocket } from '@/utils/socket';

export default function AdminDashboard() {
  const router = useRouter();

  // App data state
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'OPERATIONS' | 'CRM' | 'PAYMENTS' | 'INVENTORY' | 'BILLING' | 'JAR_TRACKING'>('DASHBOARD');
  const [isLoading, setIsLoading] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [selectedOpTab, setSelectedOpTab] = useState<'ALL' | 'PENDING' | 'DISPATCH' | 'DELIVERED'>('PENDING');

  // Operations actions state
  const [assigningOrder, setAssigningOrder] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState('Sandeep Patil');
  const [dispatchingOrder, setDispatchingOrder] = useState<any>(null);
  const [dispatchDriver, setDispatchDriver] = useState('Sandeep Patil');
  const [deliveringOrder, setDeliveringOrder] = useState<any>(null);
  const [empties, setEmpties] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const [lost, setLost] = useState(0);

  // CRM edit state
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editWalletBalance, setEditWalletBalance] = useState('');
  const [editPendingDues, setEditPendingDues] = useState('');

  // CRM details modal state
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<any>(null);
  const [crmModalTab, setCrmModalTab] = useState<'JARS' | 'ORDERS' | 'PAYMENTS'>('JARS');

  // Inventory edit state
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [newStockQty, setNewStockQty] = useState('50');

  // Jar tracking details state
  const [jarStats, setJarStats] = useState<any>(null);
  const [jarCustomers, setJarCustomers] = useState<any[]>([]);
  const [jarMovementTrend, setJarMovementTrend] = useState<any[]>([]);
  const [jarDistribution, setJarDistribution] = useState<any[]>([]);
  const [jarCustomerHoldings, setJarCustomerHoldings] = useState<any[]>([]);
  const [jarFilter, setJarFilter] = useState<'ALL' | 'OVERDUE' | 'HIGHEST'>('ALL');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('ALL');

  // Deposit adjustment state
  const [adjustingDepositCustomer, setAdjustingDepositCustomer] = useState<any>(null);
  const [depositAdjustmentAction, setDepositAdjustmentAction] = useState<'CHARGE' | 'REFUND' | 'ADJUST_LOST'>('CHARGE');
  const [depositAdjustmentAmount, setDepositAdjustmentAmount] = useState('');
  const [depositAdjustmentJars, setDepositAdjustmentJars] = useState('');

  const driversList = ['Sandeep Patil', 'Vijay Shinde', 'Rahul Kadam', 'Amol Pawar'];

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
      if (meData.user.role !== 'ADMIN') {
        router.push('/customer/dashboard');
        return;
      }
      setUser(meData.user);

      // 2. Fetch all orders
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders);
      }

      // 3. Fetch CRM customers
      const customersRes = await fetch('/api/customers');
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData.customers);
      }

      // 4. Fetch inventory
      const inventoryRes = await fetch('/api/inventory');
      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        setInventory(inventoryData.inventory);
      }

      // 5. Fetch notifications
      const notifsRes = await fetch('/api/notifications');
      if (notifsRes.ok) {
        const notifsData = await notifsRes.json();
        setNotifications(notifsData.notifications);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Set up socket listener for live notification events
  useEffect(() => {
    if (!user) return;

    const roomName = 'admin_room';
    connectSocket(roomName);
    const socket = getSocket();

    socket.on('admin-notification', (data: any) => {
      // Trigger toast/browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, { body: data.message });
      }
      loadDashboardData();
    });

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

  // Operations actions
  const handleUpdateOrderStatus = async (orderId: string, status: string, additionalPayload: any = {}) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...additionalPayload })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Emit status updates to customer via WebSockets
      const socket = getSocket();
      if (socket.connected) {
        socket.emit('order-updated', {
          orderId,
          status,
          customerId: data.order.customerId
        });
      }

      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Failed to update order status.');
    }
  };

  // CRM operations
  const handleSaveCustomerSettings = async () => {
    if (!editingCustomer) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCustomer.id,
          creditLimit: editCreditLimit,
          walletBalance: editWalletBalance,
          pendingDues: editPendingDues
        })
      });

      if (!res.ok) throw new Error('Failed to update');

      alert('Customer configurations updated!');
      setEditingCustomer(null);
      loadDashboardData();
    } catch (e) {
      alert('Update failed.');
    }
  };

  // Inventory Operations
  const handleAddStock = async () => {
    if (!inventory) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availableJars: inventory.availableJars + Number(newStockQty)
        })
      });

      if (!res.ok) throw new Error('Stock update failed');

      alert(`Added ${newStockQty} available jars to inventory!`);
      setIsAddStockOpen(false);
      loadDashboardData();
    } catch (e) {
      alert('Stock adjustment failed.');
    }
  };

  // Dues reminder dispatch
  const handleSendReminder = (customer: any) => {
    // 1. Emit live alert over socket
    const socket = getSocket();
    if (socket.connected) {
      socket.emit('send-dues-alert', {
        customerId: customer.id,
        amount: customer.pendingDues,
        dueDate: '5th'
      });
    }

    // 2. Open wa.me URL
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const textMsg = `Hi ${customer.name}, this is a gentle payment reminder from Chhatrapati Aqua. Your outstanding dues balance is ₹${customer.pendingDues}. Please settle it as soon as possible. Thank you!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`, '_blank');
  };

  const handleDownloadInvoice = (order: any) => {
    const pricePerJar = 21.19;
    const subtotal = order.quantity * pricePerJar;
    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const total = order.totalAmount;

    // Resolve name from include customer profile
    const name = order.customer?.user?.name || 'Customer';
    const phone = order.customer?.user?.phone || '';
    const address = order.customer?.address || '';
    const qrId = order.customer?.qrCodeId || '';

    downloadInvoicePDF({
      invoiceNum: `INV-2026-${order.id.split('-')[0]}`,
      customerName: name,
      customerPhone: phone,
      customerAddress: address,
      customerQrId: qrId,
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

  const loadJarTrackingData = useCallback(async () => {
    try {
      const res = await fetch(`/api/jar-tracking?filter=${jarFilter}`);
      if (!res.ok) throw new Error('Failed to load jar tracking data');
      const data = await res.json();
      setJarStats(data.stats);
      setJarCustomers(data.customersList);
      setJarMovementTrend(data.jarMovementTrend);
      setJarDistribution(data.outstandingDistribution);
      setJarCustomerHoldings(data.customerWiseHoldings);
    } catch (error) {
      console.error('Error fetching jar tracking:', error);
    }
  }, [jarFilter]);

  const handleAdjustDeposit = async () => {
    if (!adjustingDepositCustomer) return;
    try {
      const res = await fetch('/api/jar-tracking/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: adjustingDepositCustomer.id,
          action: depositAdjustmentAction,
          amount: Number(depositAdjustmentAmount) || 0,
          jars: Number(depositAdjustmentJars) || 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust security deposit');

      alert(`Successfully adjusted deposit: ${depositAdjustmentAction} of ₹${depositAdjustmentAmount}`);
      setAdjustingDepositCustomer(null);
      setDepositAdjustmentAmount('');
      setDepositAdjustmentJars('');
      loadJarTrackingData();
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || 'Deposit adjustment failed.');
    }
  };

  useEffect(() => {
    if (activeTab === 'JAR_TRACKING') {
      loadJarTrackingData();
    }
  }, [activeTab, jarFilter, loadJarTrackingData]);

  const getAreaName = (address: string) => {
    if (!address) return 'Other';
    const addr = address.toLowerCase();
    if (addr.includes('residency') || addr.includes('shivneri')) return 'Shivneri Residency';
    if (addr.includes('dongerkinhi') || addr.includes('dongekinhi')) return 'Dongerkinhi';
    if (addr.includes('baner') || addr.includes('pune')) return 'Baner Pune';
    return 'Other';
  };

  // Analytics Dynamic values
  const totalRevenue = orders
    .filter(o => o.status === 'DELIVERED' && o.paymentStatus === 'PAID')
    .reduce((a, c) => a + c.totalAmount, 0);

  const pendingRevenue = orders
    .filter(o => o.paymentStatus === 'PENDING')
    .reduce((a, c) => a + c.totalAmount, 0);

  const todayOrders = orders.filter(o => {
    const todayStr = new Date().toISOString().split('T')[0];
    return o.createdAt.includes(todayStr);
  });

  const todayJars = todayOrders
    .filter(o => o.status === 'DELIVERED')
    .reduce((a, c) => a + c.quantity, 0);

  // Charts mock lists populated with database values
  const weeklyRevenueData = [
    { name: 'Mon', revenue: 1200 },
    { name: 'Tue', revenue: 1800 },
    { name: 'Wed', revenue: 1500 },
    { name: 'Thu', revenue: 2200 },
    { name: 'Fri', revenue: 2900 },
    { name: 'Sat', revenue: 2500 },
    { name: 'Sun', revenue: 1500 + totalRevenue }
  ];

  const weeklyVolumeData = [
    { name: 'Mon', jars: 48 },
    { name: 'Tue', jars: 72 },
    { name: 'Wed', jars: 60 },
    { name: 'Thu', jars: 88 },
    { name: 'Fri', jars: 116 },
    { name: 'Sat', jars: 100 },
    { name: 'Sun', jars: 60 + orders.filter(o => o.status === 'DELIVERED').reduce((a, c) => a + c.quantity, 0) }
  ];

  const filteredOpOrders = orders.filter(o => {
    if (selectedOpTab === 'ALL') return true;
    if (selectedOpTab === 'PENDING') return o.status === 'RECEIVED' || o.status === 'ACCEPTED';
    if (selectedOpTab === 'DISPATCH') return o.status === 'OUT_FOR_DELIVERY';
    if (selectedOpTab === 'DELIVERED') return o.status === 'DELIVERED' || o.status === 'CANCELLED';
    return true;
  });

  // Render view helpers
  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin inline-block"></span>
          <p className="text-xs text-slate-400 font-bold">Synchronizing Sandbox Console...</p>
        </div>
      </div>
    );
  }

  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#050b18] text-slate-100">

      {/* Header bar */}
      <header className="h-16 shrink-0 border-b border-sky-500/10 bg-[#070f23]/80 backdrop-blur-md sticky top-0 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center glow-aqua">
            <Droplet className="h-5 w-5 text-white fill-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide uppercase">Chhatrapati Aqua</h1>
            <p className="text-[9px] text-slate-400 font-semibold tracking-wider">Administrative Operations SaaS</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNotifOpen(true)}
            className="p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-900 border border-slate-800 relative"
          >
            <Bell className="h-4.5 w-4.5 text-slate-350" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                {unreadNotifCount}
              </span>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-rose-950/15 hover:bg-rose-900/20 border border-rose-900/20 text-rose-455 text-xs font-bold transition-all"
            title="Log Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main workspace container */}
      <main className="flex-1 flex overflow-hidden min-h-0 relative max-w-6xl mx-auto w-full">

        {/* Sidebar Nav */}
        <aside className="w-18 md:w-56 bg-[#070f23]/60 border-r border-slate-900 flex flex-col justify-between shrink-0">
          <div className="p-3.5 space-y-5">
            <div className="hidden md:block px-3.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
              Control Panel
            </div>

            <nav className="space-y-1">
              {[
                { key: 'DASHBOARD' as const, label: 'Analytics Dashboard', icon: LayoutDashboard },
                { key: 'OPERATIONS' as const, label: 'Operations Feed', icon: ClipboardList },
                { key: 'CRM' as const, label: 'Customer CRM', icon: Users },
                { key: 'PAYMENTS' as const, label: 'Dues & Payments', icon: DollarSign },
                { key: 'INVENTORY' as const, label: 'Inventory Stock', icon: Archive },
                { key: 'BILLING' as const, label: 'Tax & Billing', icon: FileText },
                { key: 'JAR_TRACKING' as const, label: 'Jar Tracking', icon: Layers }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full py-3 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 ${isActive
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                      }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-slate-900 text-center hidden md:block">
            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">SaaS Node Server</span>
            <span className="text-[10px] text-emerald-400 font-bold mt-1 inline-flex items-center gap-1 bg-emerald-950/45 px-2 py-0.5 rounded-full border border-emerald-900/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live SQL Client
            </span>
          </div>
        </aside>

        {/* Dashboard Panels Scroll container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar bg-[#050b18]/10 min-w-0">
          <div className="space-y-6">

            {/* DASHBOARD TAB */}
            {activeTab === 'DASHBOARD' && (
              <div className="space-y-6">

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Customers */}
                  <div className="glass-card rounded-2xl p-5 border border-cyan-500/10 flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Total Customers</span>
                      <h3 className="text-2xl font-extrabold text-white">{customers.length}</h3>
                      <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        CRM Database Active
                      </span>
                    </div>
                    <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl glow-aqua">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>

                  {/* Today's Orders */}
                  <div className="glass-card rounded-2xl p-5 border border-blue-500/10 flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Today's Orders</span>
                      <h3 className="text-2xl font-extrabold text-white">{todayOrders.length}</h3>
                      <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Live Feed Queue
                      </span>
                    </div>
                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                  </div>

                  {/* Today's Jars Delivered */}
                  <div className="glass-card rounded-2xl p-5 border border-emerald-500/10 flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Today's Jars</span>
                      <h3 className="text-2xl font-extrabold text-white">{todayJars} Jars</h3>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {inventory?.available || 0} in stock
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                      <Truck className="h-6 w-6" />
                    </div>
                  </div>

                  {/* Outstanding Dues */}
                  <div className="glass-card rounded-2xl p-5 border border-rose-500/10 flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Outstanding Dues</span>
                      <h3 className="text-2xl font-extrabold text-rose-400">₹{customers.reduce((acc, c) => acc + c.pendingDues, 0)}</h3>
                      <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Reminders Ready
                      </span>
                    </div>
                    <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>
                </div>

                {/* Analytical Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Weekly Area Chart */}
                  <div className="glass-card rounded-2xl p-5 border border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-200">Revenue Stream (Weekly)</h4>
                      <span className="text-xs font-bold text-cyan-400">Total: ₹{weeklyRevenueData.reduce((acc, c) => acc + c.revenue, 0)}</span>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeklyRevenueData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                          <defs>
                            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#09132c', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', color: '#fff' }} />
                          <Area type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Volume Delivered Bar Chart */}
                  <div className="glass-card rounded-2xl p-5 border border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-200">Volume Track (Jars)</h4>
                      <span className="text-xs font-bold text-blue-400">Fleet: 4 Drivers</span>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyVolumeData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#09132c', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', color: '#fff' }} />
                          <Bar dataKey="jars" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Regional Statistics */}
                <div className="glass-card rounded-2xl p-5 border border-slate-800">
                  <h4 className="text-sm font-bold text-slate-200 mb-4">Area Wise Consumption Analytics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Dongerkinhi', 'Shivneri Residency', 'Baner Pune'].map((area, idx) => {
                      const sampleJars = [190, 80, 50][idx];
                      return (
                        <div key={area} className="bg-slate-950/45 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase font-semibold">{area}</span>
                            <span className="text-sm font-bold text-slate-200">{sampleJars} Jars</span>
                          </div>
                          <span className="text-xs font-bold text-cyan-400">{[59, 25, 16][idx]}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* OPERATIONS FEED TAB */}
            {activeTab === 'OPERATIONS' && (
              <div className="space-y-4">

                {/* Status Queues Tabs */}
                <div className="flex gap-2 border-b border-slate-850 pb-3 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'PENDING' as const, label: 'New / Accepted' },
                    { key: 'DISPATCH' as const, label: 'Out for Delivery' },
                    { key: 'DELIVERED' as const, label: 'Completed' },
                    { key: 'ALL' as const, label: 'All Orders' }
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setSelectedOpTab(t.key)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${selectedOpTab === t.key ? 'bg-cyan-500 text-white shadow-md' : 'bg-slate-900/30 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Operations feed grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                  {filteredOpOrders.map(order => (
                    <div key={order.id} className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between">
                      <div className="space-y-3.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] text-slate-500 font-mono">#{order.id.split('-')[0]} • {new Date(order.createdAt).toLocaleDateString()}</span>
                            <h4 className="text-sm font-extrabold text-slate-200 mt-0.5 capitalize">{order.customer?.user?.name || 'Customer'}</h4>
                            <p className="text-[10px] text-slate-400">{order.customer?.user?.phone}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${order.status === 'RECEIVED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            order.status === 'ACCEPTED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              order.status === 'OUT_FOR_DELIVERY' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                            }`}>
                            {order.status}
                          </span>
                        </div>

                        <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-900 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Items Ordered:</span>
                            <span className="font-bold text-white">{order.quantity} Jars (20L)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Price:</span>
                            <span className="font-bold text-cyan-400">₹{order.totalAmount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Payment status:</span>
                            <span className="font-semibold text-slate-350">{order.paymentMethod} ({order.paymentStatus})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Address:</span>
                            <span className="text-slate-300 text-right max-w-[150px] truncate">{order.customer?.address}</span>
                          </div>
                          {order.delivery?.driverId && (
                            <div className="flex justify-between border-t border-slate-900 pt-1.5 mt-1.5">
                              <span className="text-slate-455">Assigned driver:</span>
                              <span className="text-slate-200 font-bold flex items-center gap-1 font-mono">
                                {order.delivery?.driverName || 'Driver assigned'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-900">
                        {order.status === 'RECEIVED' && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'ACCEPTED')}
                              className="flex-grow py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                            >
                              Accept Order
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')}
                              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/25 text-rose-455 rounded-xl text-xs font-bold transition-all"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {order.status === 'ACCEPTED' && (
                          <button
                            onClick={() => {
                              setDispatchingOrder(order);
                              setDispatchDriver(driversList[0]);
                            }}
                            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                          >
                            <Truck className="h-4 w-4" />
                            Dispatch Order
                          </button>
                        )}

                        {order.status === 'OUT_FOR_DELIVERY' && (
                          <button
                            onClick={() => {
                              setEmpties(order.quantity);
                              setDamaged(0);
                              setLost(0);
                              setDeliveringOrder(order);
                            }}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Record Returns & Complete
                          </button>
                        )}

                        {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
                          <p className="w-full text-center text-[10px] text-slate-500 italic py-1">
                            {order.status === 'DELIVERED'
                              ? `Completed successfully. rating: ${order.delivery?.rating ? `${order.delivery.rating}/5 stars` : 'pending'}`
                              : 'Order cancelled.'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredOpOrders.length === 0 && (
                    <div className="col-span-2 text-center py-12 bg-slate-950/20 rounded-2xl border border-slate-850">
                      <p className="text-xs text-slate-500">No orders found in this status queue.</p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* CUSTOMER CRM TAB */}
            {activeTab === 'CRM' && (
              <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 block uppercase tracking-wider">Customer Database CRM</h4>
                <div className="space-y-4">
                  {customers.map((c) => (
                    <div key={c.id} className="p-4 bg-slate-950/45 border border-slate-900 rounded-2xl flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5
                            onClick={() => {
                              setSelectedCrmCustomer(c);
                              setCrmModalTab('JARS');
                            }}
                            className="text-sm font-extrabold text-slate-250 hover:text-cyan-400 cursor-pointer transition-colors capitalize"
                            title="Click to view history & empty jar status"
                          >
                            {c.name}
                          </h5>
                          <button
                            onClick={() => {
                              setSelectedCrmCustomer(c);
                              setCrmModalTab('JARS');
                            }}
                            className="text-[9px] font-extrabold text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 px-2 py-0.5 rounded-full border border-cyan-900/30 transition-all cursor-pointer"
                          >
                            View History
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-450 font-mono">{c.phone} | {c.email || 'no email'}</p>
                        <p className="text-[10px] text-slate-400 max-w-[250px] truncate">📍 {c.address}</p>
                        <div className="flex gap-2 pt-1">
                          <span className="text-[8.5px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">Wallet: ₹{c.walletBalance}</span>
                          <span className="text-[8.5px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">Dues: ₹{c.pendingDues}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditCreditLimit(String(c.creditLimit));
                          setEditWalletBalance(String(c.walletBalance));
                          setEditPendingDues(String(c.pendingDues));
                          setEditingCustomer(c);
                        }}
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-lg text-[10px] transition-all"
                      >
                        Adjust Limits
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DUES & REMINDERS TAB */}
            {activeTab === 'PAYMENTS' && (
              <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 block uppercase tracking-wider">Pending Dues & Collections</h4>
                <div className="space-y-4">
                  {customers.filter(c => c.pendingDues > 0).map((c) => (
                    <div key={c.id} className="p-4 bg-slate-950/45 border border-slate-900 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <h5 className="text-sm font-extrabold text-slate-200 capitalize">{c.name}</h5>
                        <span className="text-[10px] text-slate-500 font-mono block">{c.phone}</span>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[9px] text-rose-455 font-bold">Outstanding: ₹{c.pendingDues}</span>
                          <span className="text-[9px] text-slate-500 font-semibold">Credit Limit: ₹{c.creditLimit}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendReminder(c)}
                        className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/25 hover:border-transparent text-rose-455 rounded-xl text-[10px] font-extrabold transition-all"
                      >
                        Send Reminder Alert
                      </button>
                    </div>
                  ))}
                  {customers.filter(c => c.pendingDues > 0).length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-500">No customers have outstanding dues.</p>
                  )}
                </div>
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'INVENTORY' && inventory && (
              <div className="space-y-6">

                {/* Stats grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Available Stock</span>
                    <h3 className="text-2xl font-black text-white mt-1">{inventory.available} Jars</h3>
                    {inventory.available < 20 && (
                      <span className="text-[9px] text-amber-500 font-bold block mt-1">⚠️ safety stock warning!</span>
                    )}
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Returned Empty</span>
                    <h3 className="text-2xl font-black text-cyan-400 mt-1">{inventory.returned} Jars</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Damaged Jars</span>
                    <h3 className="text-2xl font-black text-rose-450 mt-1">{inventory.damaged} Jars</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Lost / Stolen</span>
                    <h3 className="text-2xl font-black text-slate-400 mt-1">{inventory.lost} Jars</h3>
                  </div>
                </div>

                {/* Adjustments */}
                <div className="glass-card rounded-2xl p-5 border border-slate-800 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Inventory Stock Control</h4>
                    <p className="text-[10px] text-slate-550 mt-0.5">Procure or adjust available stock levels.</p>
                  </div>
                  <button
                    onClick={() => setIsAddStockOpen(true)}
                    className="py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-xs font-bold shadow-md transition-all glow-aqua"
                  >
                    + Procure Water Jars
                  </button>
                </div>
              </div>
            )}

            {/* BILLING TAB */}
            {activeTab === 'BILLING' && (
              <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-slate-200 block uppercase tracking-wider">GST Invoices & Statements</h4>
                <div className="space-y-4">
                  {orders.filter(o => o.status === 'DELIVERED').map((o) => (
                    <div key={o.id} className="p-4 bg-slate-950/45 border border-slate-900 rounded-2xl flex justify-between items-center text-xs">
                      <div>
                        <h5 className="text-sm font-extrabold text-slate-250 capitalize">{o.customer?.user?.name || 'Customer'}</h5>
                        <span className="text-[9.5px] text-slate-500 font-mono block">Order ID: #{o.id.split('-')[0]} | {new Date(o.createdAt).toLocaleDateString()}</span>
                        <p className="text-[9.5px] text-cyan-400 font-bold mt-1">₹{o.totalAmount} for {o.quantity} Jars ({o.paymentMethod})</p>
                      </div>
                      <button
                        onClick={() => handleDownloadInvoice(o)}
                        className="py-2 px-3 bg-cyan-500/10 hover:bg-cyan-500 hover:text-slate-900 border border-cyan-500/25 text-cyan-400 rounded-xl text-[10px] font-extrabold transition-all flex items-center gap-1 shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                        GST Invoice
                      </button>
                    </div>
                  ))}
                  {orders.filter(o => o.status === 'DELIVERED').length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-500">No completed orders to bill.</p>
                  )}
                </div>
              </div>
            )}

            {/* JAR TRACKING TAB */}
            {activeTab === 'JAR_TRACKING' && (
              <div className="space-y-6 animate-fadeIn">

                {/* Stats cards grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Total Stock</span>
                    <h3 className="text-2xl font-black text-white mt-1">{jarStats?.totalJarsInStock || 0} Jars</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Outstanding Jars</span>
                    <h3 className="text-2xl font-black text-cyan-400 mt-1">{jarStats?.jarsWithCustomers || 0} Jars</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Damaged Jars</span>
                    <h3 className="text-2xl font-black text-rose-450 mt-1">{jarStats?.damagedJars || 0} Jars</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Lost / Stolen</span>
                    <h3 className="text-2xl font-black text-slate-400 mt-1">{jarStats?.lostJars || 0} Jars</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Total in Circulation</span>
                    <h3 className="text-2xl font-black text-white mt-1">{jarStats?.circulation || 0} Jars</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Recovery Rate</span>
                    <h3 className="text-2xl font-black text-emerald-400 mt-1">{jarStats?.recoveryRate || 0}%</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Collection Efficiency</span>
                    <h3 className="text-2xl font-black text-cyan-400 mt-1">{jarStats?.collectionEfficiency || 0}%</h3>
                  </div>

                  <div className="glass-card rounded-2xl p-4 border border-slate-800 text-center">
                    <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Total Deposited</span>
                    <h3 className="text-2xl font-black text-amber-500 mt-1 font-mono">
                      ₹{jarCustomers.reduce((acc, c) => acc + c.deposit, 0)}
                    </h3>
                  </div>
                </div>

                {/* Analytical Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Jar Movement Trends Area Chart */}
                  <div className="glass-card rounded-2xl p-5 border border-slate-800">
                    <h4 className="text-xs font-bold text-slate-200 mb-4 font-mono uppercase tracking-wider text-[11px]">Jar Movement Trend (7 Days)</h4>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={jarMovementTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                          <defs>
                            <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#09132c', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', color: '#fff' }} />
                          <Area type="monotone" dataKey="delivered" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#delGrad)" name="Delivered" />
                          <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colGrad)" name="Collected" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Outstanding Distribution Chart */}
                  <div className="glass-card rounded-2xl p-5 border border-slate-800">
                    <h4 className="text-xs font-bold text-slate-200 mb-4 font-mono uppercase tracking-wider text-[11px]">Outstanding Distribution</h4>
                    <div className="h-56 flex items-center justify-between">
                      <div className="flex-1 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={jarDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={5}
                              dataKey="count"
                            >
                              {jarDistribution.map((entry, index) => {
                                const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#7f1d1d'];
                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                              })}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#09132c', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', color: '#fff' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-2 pr-4 text-xs shrink-0">
                        {jarDistribution.map((d, index) => {
                          const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#7f1d1d'];
                          return (
                            <div key={d.name} className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></span>
                              <span className="text-slate-300 font-semibold">{d.name}: {d.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider text-[10px]">Area filter</span>
                    <select
                      value={selectedAreaFilter}
                      onChange={(e) => setSelectedAreaFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                    >
                      <option value="ALL">All Areas</option>
                      <option value="Dongerkinhi">Dongerkinhi</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider text-[10px]">Status Filter</span>
                    <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {[
                        { key: 'ALL' as const, label: 'All Ledgers' },
                        { key: 'OVERDUE' as const, label: 'Overdue (5+)' },
                        { key: 'HIGHEST' as const, label: 'Highest First' }
                      ].map((btn) => (
                        <button
                          key={btn.key}
                          onClick={() => setJarFilter(btn.key)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${jarFilter === btn.key
                            ? 'bg-cyan-500 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Customer Jar Ledger Table */}
                <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-850 flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono text-[11px]">Customer Jar Ledgers</h4>
                    <span className="text-[10px] text-slate-500 font-bold">{jarCustomers.length} Records</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/40 text-slate-400 uppercase tracking-wider text-[9px] border-b border-slate-850">
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Area</th>
                          <th className="py-3 px-4 text-center">Delivered</th>
                          <th className="py-3 px-4 text-center">Collected</th>
                          <th className="py-3 px-4 text-center">Outstanding</th>
                          <th className="py-3 px-4 text-center">Deposit Hold</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {jarCustomers
                          .filter((c) => {
                            if (selectedAreaFilter === 'ALL') return true;
                            const normalizedArea = getAreaName(c.address);
                            return normalizedArea === selectedAreaFilter;
                          })
                          .map((c) => {
                            const outstandingColor = c.outstanding === 0
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : c.outstanding <= 5
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-455 border-rose-500/20';

                            return (
                              <tr key={c.id} className="hover:bg-slate-900/20 transition-all">
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-slate-200 capitalize">{c.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.phone}</div>
                                </td>
                                <td className="py-3.5 px-4 text-slate-400">
                                  {getAreaName(c.address)}
                                </td>
                                <td className="py-3.5 px-4 text-center text-slate-300 font-semibold">{c.delivered}</td>
                                <td className="py-3.5 px-4 text-center text-slate-300 font-semibold">{c.collected}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-2.5 py-0.5 rounded border text-[10px] font-bold ${outstandingColor}`}>
                                    {c.outstanding}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center text-amber-500 font-bold font-mono">
                                  ₹{c.deposit}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => {
                                        setAdjustingDepositCustomer(c);
                                        setDepositAdjustmentAction('CHARGE');
                                        setDepositAdjustmentAmount('');
                                        setDepositAdjustmentJars('');
                                      }}
                                      className="py-1 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                                    >
                                      Adjust Deposit
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {jarCustomers.filter((c) => {
                          if (selectedAreaFilter === 'ALL') return true;
                          const normalizedArea = getAreaName(c.address);
                          return normalizedArea === selectedAreaFilter;
                        }).length === 0 && (
                            <tr>
                              <td colSpan={7} className="text-center py-6 text-xs text-slate-500">
                                No records found matching current area filter.
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </main>

      {/* OVERLAY MODALS & PORTALS */}
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
                  Live System Alert Logs
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
                      className={`p-3.5 rounded-xl border relative ${n.isRead ? 'bg-slate-950/20 border-slate-850 opacity-60' : 'bg-[#09142e] border-cyan-500/20 shadow-md'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="px-1.5 py-0.2 rounded text-[7px] font-bold bg-cyan-950 text-cyan-400">
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



        {/* Record Returns and Complete Modal */}
        {deliveringOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Deliver & Record Empty Jars</h4>
              <p className="text-[10px] text-slate-450">Set returns logged by delivery crew for Order #{deliveringOrder.id.split('-')[0]}.</p>

              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span>Empties Collected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEmpties(Math.max(0, empties - 1))} className="h-6 w-6 bg-slate-950 rounded text-slate-400 border border-slate-800">-</button>
                    <span className="font-bold text-white w-4 text-center">{empties}</span>
                    <button onClick={() => setEmpties(empties + 1)} className="h-6 w-6 bg-slate-950 rounded text-slate-400 border border-slate-800">+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span>Damaged Jars</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDamaged(Math.max(0, damaged - 1))} className="h-6 w-6 bg-slate-950 rounded text-slate-400 border border-slate-800">-</button>
                    <span className="font-bold text-white w-4 text-center">{damaged}</span>
                    <button onClick={() => setDamaged(damaged + 1)} className="h-6 w-6 bg-slate-950 rounded text-slate-400 border border-slate-800">+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span>Misplaced / Lost</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLost(Math.max(0, lost - 1))} className="h-6 w-6 bg-slate-950 rounded text-slate-400 border border-slate-800">-</button>
                    <span className="font-bold text-white w-4 text-center">{lost}</span>
                    <button onClick={() => setLost(lost + 1)} className="h-6 w-6 bg-slate-950 rounded text-slate-400 border border-slate-800">+</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setDeliveringOrder(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-450 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleUpdateOrderStatus(deliveringOrder.id, 'DELIVERED', {
                      emptyJarsReturned: empties,
                      damagedJars: damaged,
                      lostJars: lost
                    });
                    setDeliveringOrder(null);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all hover:bg-emerald-500"
                >
                  Confirm Delivery
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Dispatch Order Modal */}
        {dispatchingOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Dispatch Order</h4>
                  <p className="text-[10px] text-slate-400">Order #{dispatchingOrder.id.split('-')[0]} • {dispatchingOrder.quantity} jars</p>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 text-xs space-y-1.5 border border-slate-900">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-bold text-white capitalize">{dispatchingOrder.customer?.user?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Address:</span>
                  <span className="text-slate-300 text-right max-w-[160px] truncate">{dispatchingOrder.customer?.address || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-bold text-cyan-400">₹{dispatchingOrder.totalAmount}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Assign Driver (Optional)</label>
                <select
                  value={dispatchDriver}
                  onChange={(e) => setDispatchDriver(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none"
                >
                  <option value="">— No driver assigned —</option>
                  {driversList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDispatchingOrder(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const payload: any = {};
                    if (dispatchDriver) payload.driverName = dispatchDriver;
                    await handleUpdateOrderStatus(dispatchingOrder.id, 'OUT_FOR_DELIVERY', payload);
                    setDispatchingOrder(null);
                  }}
                  className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Truck className="h-3.5 w-3.5" />
                  Dispatch
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Edit Customer Modal */}
        {editingCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4">
              <h4 className="text-sm font-bold text-white capitalize">Adjust {editingCustomer.name} Settings</h4>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Outstanding Dues (₹)</label>
                  <input
                    type="number"
                    value={editPendingDues}
                    onChange={(e) => setEditPendingDues(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Prepaid Balance (₹)</label>
                  <input
                    type="number"
                    value={editWalletBalance}
                    onChange={(e) => setEditWalletBalance(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-450 hover:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomerSettings}
                  className="flex-1 py-2.5 bg-cyan-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Detailed Customer Profile & History Modal */}
        {selectedCrmCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col justify-between overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/20">
                <div className="space-y-1">
                  <span className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/30">
                    Customer Profile & History
                  </span>
                  <h4 className="text-lg font-black text-white capitalize flex items-center gap-2 mt-1">
                    <User className="h-5 w-5 text-cyan-400" />
                    {selectedCrmCustomer.name}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    {selectedCrmCustomer.phone} | {selectedCrmCustomer.email || 'No email registered'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCrmCustomer(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sub-header Address & Stats */}
              <div className="px-5 py-3.5 bg-slate-950/40 border-b border-slate-800/60 shrink-0 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-350">
                <span className="truncate max-w-md">📍 Address: {selectedCrmCustomer.address}</span>
                <span className="shrink-0 text-slate-400 font-mono text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  QR ID: {selectedCrmCustomer.qrCodeId}
                </span>
              </div>

              {/* Tab Selector */}
              <div className="px-5 pt-3 flex gap-2 border-b border-slate-800/50 bg-slate-900/50 shrink-0">
                {[
                  { key: 'JARS' as const, label: 'Empty Jars Ledger' },
                  { key: 'ORDERS' as const, label: 'Order History' },
                  { key: 'PAYMENTS' as const, label: 'Payment Details' }
                ].map((tab) => {
                  const isActive = crmModalTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setCrmModalTab(tab.key)}
                      className={`pb-3 px-3 text-xs font-bold transition-all relative ${isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="activeCrmTabLine"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Content Panel (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">

                {/* 1. JARS TAB */}
                {crmModalTab === 'JARS' && (
                  <div className="space-y-4">
                    {/* Jar Summary Card */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3.5 text-center">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Delivered</span>
                        <span className="text-xl font-black text-cyan-400 mt-1 block">
                          {selectedCrmCustomer.jarLedger?.deliveredJars || 0}
                        </span>
                      </div>
                      <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-3.5 text-center">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Collected</span>
                        <span className="text-xl font-black text-emerald-450 mt-1 block">
                          {selectedCrmCustomer.jarLedger?.collectedJars || 0}
                        </span>
                      </div>
                      <div className="bg-[#0f1b2b] border border-cyan-500/10 rounded-2xl p-3.5 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-cyan-500/5 rounded-full blur-md"></div>
                        <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">With Customer</span>
                        <span className="text-xl font-black text-white mt-1 block">
                          {selectedCrmCustomer.jarLedger?.balance || 0} Jars
                        </span>
                      </div>
                    </div>

                    {/* Jar Ledger History list */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-slate-350 block uppercase tracking-wider">Jar Transactions Ledger</h5>
                      <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950/20">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950/60 text-slate-500 border-b border-slate-800 font-bold">
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Transaction</th>
                              <th className="py-2.5 px-3 text-right">Quantity</th>
                              <th className="py-2.5 px-3">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedCrmCustomer.jarTransactions && selectedCrmCustomer.jarTransactions.length > 0 ? (
                              selectedCrmCustomer.jarTransactions.map((txn: any) => (
                                <tr key={txn.id} className="border-b border-slate-900/50 hover:bg-slate-900/10 text-slate-300">
                                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                                    {new Date(txn.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${txn.type === 'DELIVERY' ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-900/20' : 'bg-emerald-950/60 text-emerald-450 border border-emerald-900/20'
                                      }`}>
                                      {txn.type}
                                    </span>
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-extrabold ${txn.type === 'DELIVERY' ? 'text-cyan-400' : 'text-emerald-450'}`}>
                                    {txn.quantity}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-400 italic text-[11px] truncate max-w-[150px]">
                                    {txn.remarks || '-'}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="text-center py-8 text-xs text-slate-500 italic">
                                  No empty jar transactions registered.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ORDERS TAB */}
                {crmModalTab === 'ORDERS' && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-350 block uppercase tracking-wider">All Customer Orders</h5>
                    <div className="space-y-2">
                      {selectedCrmCustomer.orders && selectedCrmCustomer.orders.length > 0 ? (
                        selectedCrmCustomer.orders.map((order: any) => (
                          <div key={order.id} className="bg-slate-950/30 border border-slate-850 p-3 rounded-xl flex justify-between items-center text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-200">{order.quantity} Jars (20L)</span>
                                <span className="text-[10px] text-slate-500 font-mono">#{order.id.split('-')[0]}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Date: {new Date(order.createdAt).toLocaleDateString()} | Method: {order.paymentMethod}
                              </p>
                              {order.notes && <p className="text-[10px] text-slate-450 italic">Note: {order.notes}</p>}
                            </div>
                            <div className="text-right space-y-1.5">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold inline-block ${order.status === 'DELIVERED' ? 'bg-emerald-950/45 text-emerald-400 border border-emerald-900/20' :
                                order.status === 'CANCELLED' ? 'bg-rose-950/45 text-rose-400 border border-rose-900/20' :
                                  'bg-cyan-950/45 text-cyan-400 border border-cyan-900/20'
                                }`}>
                                {order.status}
                              </span>
                              <span className="text-xs font-black text-white block">₹{order.totalAmount}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-8 text-xs text-slate-500 italic">No orders found for this customer.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. PAYMENTS TAB */}
                {crmModalTab === 'PAYMENTS' && (
                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-slate-350 block uppercase tracking-wider">Payment Ledger History</h5>
                    <div className="space-y-2">
                      {selectedCrmCustomer.payments && selectedCrmCustomer.payments.length > 0 ? (
                        selectedCrmCustomer.payments.map((pmt: any) => (
                          <div key={pmt.id} className="bg-slate-950/30 border border-slate-850 p-3 rounded-xl flex justify-between items-center text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-450">₹{pmt.amount}</span>
                                <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono uppercase">{pmt.method}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Date: {pmt.paidAt ? new Date(pmt.paidAt).toLocaleDateString() : new Date(pmt.createdAt).toLocaleDateString()}
                              </p>
                              {pmt.txRef && <p className="text-[9px] text-slate-500 font-mono">Ref ID: {pmt.txRef}</p>}
                            </div>
                            <div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${pmt.status === 'PAID' ? 'bg-emerald-950/45 text-emerald-400 border border-emerald-900/20' :
                                pmt.status === 'FAILED' ? 'bg-rose-950/45 text-rose-400 border border-rose-900/20' :
                                  'bg-amber-950/45 text-amber-400 border border-amber-900/20'
                                }`}>
                                {pmt.status}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-8 text-xs text-slate-500 italic">No payments logged yet.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 flex justify-end shrink-0">
                <button
                  onClick={() => setSelectedCrmCustomer(null)}
                  className="py-2 px-5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Procure Stock Modal */}
        {isAddStockOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[300px] p-6 space-y-4">
              <h4 className="text-sm font-bold text-white">Procure Safety Stock</h4>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Jar Count</label>
                <input
                  type="number"
                  value={newStockQty}
                  onChange={(e) => setNewStockQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-white"
                />
              </div>
              <button
                onClick={handleAddStock}
                className="w-full py-2.5 bg-cyan-500 text-white rounded-xl text-xs font-bold glow-aqua"
              >
                Approve Procurement
              </button>
              <button
                onClick={() => setIsAddStockOpen(false)}
                className="w-full py-2.5 bg-slate-800 text-slate-450 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Deposit Adjustment Modal */}
        {adjustingDepositCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[320px] p-6 space-y-4 animate-fadeIn">
              <h4 className="text-sm font-bold text-white capitalize">Adjust Deposit - {adjustingDepositCustomer.name}</h4>

              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Action Type</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {(['CHARGE', 'REFUND', 'ADJUST_LOST'] as const).map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => {
                          setDepositAdjustmentAction(act);
                          if (act !== 'ADJUST_LOST') {
                            setDepositAdjustmentJars('');
                          }
                        }}
                        className={`py-1.5 rounded-lg text-[9px] font-bold transition-all ${depositAdjustmentAction === act
                          ? 'bg-cyan-500 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        {act === 'CHARGE' ? 'Charge' : act === 'REFUND' ? 'Refund' : 'Lost Jars'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                    {depositAdjustmentAction === 'CHARGE' ? 'Deposit Amount to Charge (₹)' :
                      depositAdjustmentAction === 'REFUND' ? 'Deposit Amount to Refund (₹)' :
                        'Deduction Amount from Deposit (₹)'}
                  </label>
                  <input
                    type="number"
                    value={depositAdjustmentAmount}
                    onChange={(e) => setDepositAdjustmentAmount(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                {depositAdjustmentAction === 'ADJUST_LOST' && (
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                      Jars to Write-off / Deduct (Balance: {adjustingDepositCustomer.outstanding})
                    </label>
                    <input
                      type="number"
                      value={depositAdjustmentJars}
                      onChange={(e) => setDepositAdjustmentJars(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setAdjustingDepositCustomer(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-450 hover:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustDeposit}
                  className="flex-1 py-2.5 bg-cyan-500 text-white rounded-xl text-xs font-bold"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );

  function setEmempties(val: number) {
    setEmpties(val);
  }
}
