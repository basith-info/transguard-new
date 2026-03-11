import React, { useState, useEffect, useCallback } from "react";
import {
  Soup, Plus, Search, Building2, Phone, MapPin, CheckCircle2, AlertCircle,
  Calendar, ChevronLeft, ChevronRight, X, Edit3, Trash2, Lock, Download,
  Users
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";

const StatCard = ({ label, value, icon: Icon, colorClass }: any) => (
  <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={22} className={colorClass.replace("bg-", "text-")} />
      </div>
    </div>
    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
    <h3 className="text-xl font-black text-brand-navy tracking-tight">{value}</h3>
  </div>
);

function getVendorInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "V";
}

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "General"];

export default function FoodModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vendors, setVendors] = useState<any[]>([]);
  const [tracking, setTracking] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<{ guards: any[]; vendors: any[] }>({ guards: [], vendors: [] });
  const [monthClosed, setMonthClosed] = useState(false);
  const [guards, setGuards] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"All" | "Paid" | "Unpaid">("All");
  const [searchGuard, setSearchGuard] = useState("");
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isVendorDetailsOpen, setIsVendorDetailsOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorLocations, setVendorLocations] = useState<any[]>([]);
  const [tempSelectedLocationClientIds, setTempSelectedLocationClientIds] = useState<number[]>([]);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingGuardEntries, setEditingGuardEntries] = useState<any>(null);

  const [newVendor, setNewVendor] = useState({ name: "", contact: "", site: "", breakfast_price: "", lunch_price: "", dinner_price: "", billing_type: "fixed" });
  const [newTracking, setNewTracking] = useState({
    guard_id: "", vendor_id: "", amount: 0, meal_type: "Lunch",
    date: new Date().toISOString().split("T")[0],
  });

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const fetchVendors = useCallback(async () => {
    const res = await fetch("/api/catering-vendors");
    setVendors(await res.json());
  }, []);

  const fetchTracking = useCallback(async () => {
    setLoading(true);
    try {
      const [trRes, grRes, closedRes] = await Promise.all([
        fetch(`/api/food-tracking?month=${month}&year=${year}`),
        fetch(`/api/food-tracking/grouped?month=${month}&year=${year}`),
        fetch(`/api/food-month/status?month=${month}&year=${year}`),
      ]);
      setTracking(await trRes.json());
      setGrouped(await grRes.json());
      const closed = await closedRes.json();
      setMonthClosed(!!closed.closed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchVendors();
    fetchGuards();
    fetchClients();
  }, []);

  const fetchGuards = async () => {
    const res = await fetch("/api/guards");
    setGuards(await res.json());
  };

  const fetchClients = async () => {
    const res = await fetch("/api/clients");
    setClients(await res.json());
  };

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  const openVendorDetails = async (vendor: any) => {
    setSelectedVendor({
      ...vendor,
      breakfast_price: vendor.breakfast_price ?? "",
      lunch_price: vendor.lunch_price ?? "",
      dinner_price: vendor.dinner_price ?? "",
      billing_type: vendor.billing_type || "fixed",
    });
    setIsVendorDetailsOpen(true);
    try {
      const res = await fetch(`/api/catering-vendors/${vendor.id}/locations`);
      const locs = await res.json();
      setVendorLocations(locs);
      setTempSelectedLocationClientIds(
        clients.filter((c) => locs.some((l: any) => l.location === c.name)).map((c) => c.id)
      );
    } catch {
      setVendorLocations([]);
    }
  };

  const saveVendorDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;
    await fetch(`/api/catering-vendors/${selectedVendor.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selectedVendor.name,
        contact: selectedVendor.contact,
        site: selectedVendor.site,
        status: selectedVendor.status,
        billing_type: selectedVendor.billing_type,
        breakfast_price: selectedVendor.breakfast_price === "" ? null : Number(selectedVendor.breakfast_price),
        lunch_price: selectedVendor.lunch_price === "" ? null : Number(selectedVendor.lunch_price),
        dinner_price: selectedVendor.dinner_price === "" ? null : Number(selectedVendor.dinner_price),
      }),
    });
    await fetch(`/api/catering-vendors/${selectedVendor.id}/locations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: tempSelectedLocationClientIds.map((id) => clients.find((c) => c.id === id)?.name).filter(Boolean),
      }),
    });
    setIsVendorDetailsOpen(false);
    setSelectedVendor(null);
    fetchVendors();
    fetchTracking();
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/catering-vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newVendor,
        breakfast_price: newVendor.breakfast_price === "" ? null : Number(newVendor.breakfast_price),
        lunch_price: newVendor.lunch_price === "" ? null : Number(newVendor.lunch_price),
        dinner_price: newVendor.dinner_price === "" ? null : Number(newVendor.dinner_price),
      }),
    });
    setNewVendor({ name: "", contact: "", site: "", breakfast_price: "", lunch_price: "", dinner_price: "", billing_type: "fixed" });
    setIsVendorModalOpen(false);
    fetchVendors();
  };

  const handleAddTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTracking.amount || newTracking.amount <= 0) return alert("Amount must be greater than 0");
    await fetch("/api/food-tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newTracking, month, year }),
    });
    setNewTracking({ guard_id: "", vendor_id: "", amount: 0, meal_type: "Lunch", date: new Date().toISOString().split("T")[0] });
    setIsTrackingModalOpen(false);
    fetchTracking();
  };

  const handleMarkPaid = async (id: number) => {
    await fetch(`/api/food-tracking/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Paid", paid_date: new Date().toISOString().split("T")[0] }),
    });
    fetchTracking();
  };

  const handleMarkGuardPaid = async (guardId: number) => {
    const entries = grouped.guards.find((g) => g.guard_id === guardId)?.entries || [];
    for (const e of entries.filter((x: any) => x.status === "Unpaid")) {
      await handleMarkPaid(e.id);
    }
    fetchTracking();
  };

  const handleMarkVendorPaid = async (vendorId: number) => {
    await fetch("/api/food-tracking/mark-vendor-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_id: vendorId, month, year }),
    });
    fetchTracking();
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    await fetch(`/api/food-tracking/${editingEntry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: editingEntry.amount,
        vendor_id: editingEntry.vendor_id,
        meal_type: editingEntry.meal_type,
        date: editingEntry.date,
      }),
    });
    setEditingEntry(null);
    fetchTracking();
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/food-tracking/${id}`, { method: "DELETE" });
    setEditingEntry(null);
    setEditingGuardEntries(null);
    fetchTracking();
  };

  const handleCloseMonth = async () => {
    if (!confirm(`This will lock all food entries for ${format(currentDate, "MMMM yyyy")} and send totals to Payroll. Continue?`)) return;
    await fetch("/api/food-month/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    fetchTracking();
  };

  const handleReopenMonth = async () => {
    if (!confirm("Reopen this month for editing? (Super Admin only)")) return;
    await fetch("/api/food-month/reopen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    fetchTracking();
  };

  const unpaidEntries = tracking.filter((t) => t.status === "Unpaid" && (t.amount ?? 0) > 0);
  const totalBill = tracking.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  const totalPaid = tracking.filter((t) => t.status === "Paid").reduce((acc, t) => acc + (t.amount ?? 0), 0);
  const vendorOwed = unpaidEntries.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  const guardsWithFood = new Set(tracking.map((t) => t.guard_id)).size;

  const vendorMonthlyTotals: Record<number, { total: number; unpaid: number }> = {};
  for (const t of tracking) {
    const v = t.vendor_id;
    if (!vendorMonthlyTotals[v]) vendorMonthlyTotals[v] = { total: 0, unpaid: 0 };
    vendorMonthlyTotals[v].total += t.amount ?? 0;
    if (t.status === "Unpaid") vendorMonthlyTotals[v].unpaid += t.amount ?? 0;
  }

  const filteredGuards = grouped.guards.filter((g) => {
    if (searchGuard && !g.guard_name?.toLowerCase().includes(searchGuard.toLowerCase())) return false;
    if (filterStatus === "Paid" && g.status !== "Paid") return false;
    if (filterStatus === "Unpaid" && g.status === "Paid") return false;
    return true;
  });

  const handleExport = () => {
    const vendorList = grouped.vendors || vendors.filter((v) => v.status === "Active");
    const rows = filteredGuards.map((g) => {
      const row: Record<string, any> = { "Guard Name": g.guard_name, TOTAL: g.total, Status: g.status };
      for (const v of vendorList) {
        row[v.name] = g.vendors?.[v.id] ?? "—";
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Food Tracking");
    XLSX.writeFile(wb, `food-tracking-${format(currentDate, "yyyy-MM")}.xlsx`);
  };

  const activeVendors = vendors.filter((v) => v.status !== "Inactive");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-navy tracking-tight">Food & Meal Management</h2>
          <p className="text-slate-500 font-medium">Track catering vendor payments and salary deductions</p>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy">
            <ChevronLeft size={20} />
          </button>
          <div className="px-6 flex items-center gap-2 font-black text-brand-navy min-w-[180px] justify-center text-xs uppercase">
            <Calendar size={16} />
            {format(currentDate, "MMMM yyyy")}
          </div>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Food Bill" value={`LKR ${totalBill.toLocaleString()}`} icon={Soup} colorClass="bg-blue-500" />
        <StatCard label="Total Recovered" value={`LKR ${totalPaid.toLocaleString()}`} icon={CheckCircle2} colorClass="bg-emerald-500" />
        <StatCard label="Vendor Owed" value={`LKR ${vendorOwed.toLocaleString()}`} icon={AlertCircle} colorClass="bg-amber-500" />
        <StatCard label="Guards with Food" value={`${guardsWithFood} of ${guards.length}`} icon={Users} colorClass="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Vendor cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-brand-navy uppercase">Catering Vendors</h3>
            <button onClick={() => setIsVendorModalOpen(true)} className="p-3 bg-brand-navy hover:bg-slate-800 text-white rounded-2xl">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {vendors.map((vendor) => {
              const sum = vendorMonthlyTotals[vendor.id];
              const unpaid = sum?.unpaid ?? 0;
              return (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => openVendorDetails(vendor)}
                  className={`w-full text-left bg-white border rounded-2xl p-6 transition-all ${
                    vendor.status === "Inactive" ? "border-slate-100 opacity-60" : "border-slate-200 hover:border-brand-navy/20 hover:shadow-lg"
                  }`}
                >
                  <div className="flex items-start gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-brand-navy font-black text-sm flex-shrink-0">
                      {vendor.logo ? (
                        <img src={vendor.logo} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        getVendorInitials(vendor.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-brand-navy font-black truncate">{vendor.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">{vendor.status || "Active"}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm font-bold text-slate-500 mb-4">
                    <div className="flex items-center gap-2">
                      <Phone size={12} />
                      {vendor.contact || "—"}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={12} />
                      {vendor.site || "—"}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                      {format(currentDate, "MMMM yyyy")}: LKR {(sum?.total ?? 0).toLocaleString()}
                    </p>
                    {unpaid > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkVendorPaid(vendor.id);
                        }}
                        className="w-full py-2 rounded-xl bg-amber-100 text-amber-700 font-bold text-xs hover:bg-amber-200"
                      >
                        Mark as Paid
                      </button>
                    ) : (
                      <p className="text-xs font-bold text-emerald-600">Paid</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grouped tracking table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-black text-brand-navy uppercase">Monthly Food Tracking</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExport} className="bg-white border border-slate-200 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                <Download size={16} />
                Export
              </button>
              {!monthClosed && (
                <button
                  onClick={() => setIsTrackingModalOpen(true)}
                  className="bg-brand-navy hover:bg-slate-800 text-white px-5 py-2 rounded-xl font-black text-xs flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Entry
                </button>
              )}
              {!monthClosed && tracking.length > 0 && (
                <button onClick={handleCloseMonth} className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-xl font-bold text-sm">
                  Close {format(currentDate, "MMMM yyyy")} Food Module
                </button>
              )}
              {monthClosed && (
                <button onClick={handleReopenMonth} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-xl font-bold text-sm">
                  Reopen Month
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search guard..."
                className="w-full border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm"
                value={searchGuard}
                onChange={(e) => setSearchGuard(e.target.value)}
              />
            </div>
            {(["All", "Paid", "Unpaid"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${filterStatus === s ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-[10px] uppercase font-black text-brand-navy">
                    <th className="px-4 py-3">Guard Name</th>
                    {(grouped.vendors || activeVendors).map((v) => (
                      <th key={v.id} className="px-3 py-3 text-right min-w-[80px]">
                        {v.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">TOTAL</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {!monthClosed && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGuards.map((g) => (
                    <tr key={g.guard_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-brand-navy">{g.guard_name}</p>
                      </td>
                      {(grouped.vendors || activeVendors).map((v) => (
                        <td key={v.id} className="px-3 py-3 text-right text-sm font-bold">
                          {(g.vendors?.[v.id] ?? 0) > 0 ? `LKR ${(g.vendors[v.id] ?? 0).toLocaleString()}` : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-black text-brand-navy">
                        LKR {(g.total ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                            g.status === "Paid" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      {!monthClosed && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingGuardEntries(g)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                              title="Edit"
                            >
                              <Edit3 size={14} />
                            </button>
                            {g.status !== "Paid" && g.entries?.some((e: any) => e.status === "Unpaid") && (
                              <button
                                onClick={() => handleMarkGuardPaid(g.guard_id)}
                                className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600"
                                title="Mark as Paid"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            )}
                            {g.status === "Paid" && (
                              <span className="p-1.5 text-slate-300" title="Locked">
                                <Lock size={14} />
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredGuards.length === 0 && (
                    <tr>
                      <td colSpan={100} className="px-8 py-16 text-center text-slate-400">
                        <Soup size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">No food entries for this month</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit guard entries modal */}
      <AnimatePresence>
        {editingGuardEntries && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-black text-brand-navy">Edit entries — {editingGuardEntries.guard_name}</h3>
                <button onClick={() => setEditingGuardEntries(null)}><X size={24} /></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {editingGuardEntries.entries?.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-bold">{e.vendor_name} · {e.meal_type || "General"}</p>
                      <p className="text-xs text-slate-500">LKR {(e.amount ?? 0).toLocaleString()} · {e.date || "—"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingGuardEntries(null);
                          setEditingEntry({ ...e });
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg"
                      >
                        <Edit3 size={16} />
                      </button>
                      {e.status !== "Paid" && !monthClosed && (
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">
                          <Trash2 size={16} />
                        </button>
                      )}
                      {e.status === "Paid" && (
                        <span className="p-2 text-slate-300" title="Paid"><Lock size={16} /></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t">
                <button onClick={() => setEditingGuardEntries(null)} className="w-full py-2 rounded-xl font-bold text-slate-600 bg-slate-100">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit single entry modal */}
      <AnimatePresence>
        {editingEntry && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <h3 className="font-black text-brand-navy mb-4">Edit Entry</h3>
              <form onSubmit={handleEditEntry} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Amount (LKR)</label>
                  <input
                    type="number"
                    required
                    className="w-full border border-slate-200 rounded-xl py-3 px-4"
                    value={editingEntry.amount}
                    onChange={(e) => setEditingEntry({ ...editingEntry, amount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Date</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-xl py-3 px-4"
                    value={editingEntry.date || ""}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Meal Type</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl py-3 px-4"
                    value={editingEntry.meal_type || "General"}
                    onChange={(e) => setEditingEntry({ ...editingEntry, meal_type: e.target.value })}
                  >
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Vendor</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl py-3 px-4"
                    value={editingEntry.vendor_id}
                    onChange={(e) => setEditingEntry({ ...editingEntry, vendor_id: Number(e.target.value) })}
                  >
                    {activeVendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingEntry(null)} className="flex-1 py-2 rounded-xl font-bold text-slate-600 bg-slate-100">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-2 rounded-xl font-bold bg-brand-navy text-white">
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Vendor Modal */}
      <AnimatePresence>
        {isVendorModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6 border-b flex justify-between">
                <h3 className="text-xl font-black text-brand-navy">Add Vendor</h3>
                <button onClick={() => setIsVendorModalOpen(false)}><X size={24} /></button>
              </div>
              <form onSubmit={handleAddVendor} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Vendor Name</label>
                  <input required className="w-full border border-slate-200 rounded-xl py-3 px-4" placeholder="e.g. Niluka Catering" value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Contact</label>
                  <input className="w-full border border-slate-200 rounded-xl py-3 px-4" value={newVendor.contact} onChange={(e) => setNewVendor({ ...newVendor, contact: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Site</label>
                  <input className="w-full border border-slate-200 rounded-xl py-3 px-4" value={newVendor.site} onChange={(e) => setNewVendor({ ...newVendor, site: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase">Breakfast (LKR)</label><input type="number" className="w-full border rounded-xl py-2 px-3" value={newVendor.breakfast_price} onChange={(e) => setNewVendor({ ...newVendor, breakfast_price: e.target.value })} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase">Lunch (LKR)</label><input type="number" className="w-full border rounded-xl py-2 px-3" value={newVendor.lunch_price} onChange={(e) => setNewVendor({ ...newVendor, lunch_price: e.target.value })} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase">Dinner (LKR)</label><input type="number" className="w-full border rounded-xl py-2 px-3" value={newVendor.dinner_price} onChange={(e) => setNewVendor({ ...newVendor, dinner_price: e.target.value })} /></div>
                </div>
                <button type="submit" className="w-full py-4 rounded-xl font-black bg-brand-navy text-white">Register Vendor</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vendor Edit Modal */}
      <AnimatePresence>
        {isVendorDetailsOpen && selectedVendor && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b flex justify-between">
                <h3 className="text-xl font-black text-brand-navy">Edit Vendor</h3>
                <button onClick={() => { setIsVendorDetailsOpen(false); setSelectedVendor(null); }}><X size={24} /></button>
              </div>
              <form onSubmit={saveVendorDetails} className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Vendor Name</label>
                  <input required className="w-full border border-slate-200 rounded-xl py-3 px-4 mt-1" value={selectedVendor.name || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Contact</label>
                  <input className="w-full border border-slate-200 rounded-xl py-3 px-4 mt-1" value={selectedVendor.contact || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, contact: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Primary Site</label>
                  <input className="w-full border border-slate-200 rounded-xl py-3 px-4 mt-1" value={selectedVendor.site || ""} onChange={(e) => setSelectedVendor({ ...selectedVendor, site: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Billing Type</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="billing" checked={selectedVendor.billing_type === "fixed"} onChange={() => setSelectedVendor({ ...selectedVendor, billing_type: "fixed" })} />
                      <span className="text-sm font-bold">Fixed per meal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="billing" checked={selectedVendor.billing_type === "variable"} onChange={() => setSelectedVendor({ ...selectedVendor, billing_type: "variable" })} />
                      <span className="text-sm font-bold">Variable per guard</span>
                    </label>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Fixed: price auto-fills when adding entry. Variable: enter manually per entry.</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Status</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="status" checked={selectedVendor.status !== "Inactive"} onChange={() => setSelectedVendor({ ...selectedVendor, status: "Active" })} />
                      <span className="text-sm font-bold">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="status" checked={selectedVendor.status === "Inactive"} onChange={() => setSelectedVendor({ ...selectedVendor, status: "Inactive" })} />
                      <span className="text-sm font-bold">Inactive</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Sites Served</label>
                  <p className="text-xs text-slate-400 mb-2">Select all client sites this vendor supplies:</p>
                  <div className="flex flex-wrap gap-2">
                    {clients.map((c) => {
                      const checked = tempSelectedLocationClientIds.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl cursor-pointer border border-slate-100">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            if (e.target.checked) setTempSelectedLocationClientIds((p) => [...p, c.id]);
                            else setTempSelectedLocationClientIds((p) => p.filter((id) => id !== c.id));
                          }} />
                          <span className="text-sm font-bold">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase">Breakfast (LKR)</label><input type="number" className="w-full border rounded-xl py-2 px-3" value={selectedVendor.breakfast_price} onChange={(e) => setSelectedVendor({ ...selectedVendor, breakfast_price: e.target.value })} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase">Lunch (LKR)</label><input type="number" className="w-full border rounded-xl py-2 px-3" value={selectedVendor.lunch_price} onChange={(e) => setSelectedVendor({ ...selectedVendor, lunch_price: e.target.value })} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase">Dinner (LKR)</label><input type="number" className="w-full border rounded-xl py-2 px-3" value={selectedVendor.dinner_price} onChange={(e) => setSelectedVendor({ ...selectedVendor, dinner_price: e.target.value })} /></div>
                </div>
                <button type="submit" className="w-full py-4 rounded-xl font-black bg-brand-navy text-white">Save Vendor</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isTrackingModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6 border-b flex justify-between">
                <h3 className="text-xl font-black text-brand-navy">Add Food Entry</h3>
                <button onClick={() => setIsTrackingModalOpen(false)}><X size={24} /></button>
              </div>
              <form onSubmit={handleAddTracking} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-200 rounded-xl py-3 px-4"
                    value={newTracking.date}
                    onChange={(e) => setNewTracking({ ...newTracking, date: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Month auto-filled from {format(currentDate, "MMMM yyyy")}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Guard</label>
                  <select required className="w-full border border-slate-200 rounded-xl py-3 px-4" value={newTracking.guard_id} onChange={(e) => setNewTracking({ ...newTracking, guard_id: e.target.value })}>
                    <option value="">Choose guard...</option>
                    {guards.map((g) => (
                      <option key={g.id} value={g.id}>{g.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Vendor</label>
                  <select required className="w-full border border-slate-200 rounded-xl py-3 px-4" value={newTracking.vendor_id} onChange={(e) => setNewTracking({ ...newTracking, vendor_id: e.target.value })}>
                    <option value="">Choose vendor...</option>
                    {activeVendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Amount (LKR)</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    className="w-full border border-slate-200 rounded-xl py-3 px-4"
                    placeholder="LKR"
                    value={newTracking.amount || ""}
                    onChange={(e) => setNewTracking({ ...newTracking, amount: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Meal Type</label>
                  <select className="w-full border border-slate-200 rounded-xl py-3 px-4" value={newTracking.meal_type} onChange={(e) => setNewTracking({ ...newTracking, meal_type: e.target.value })}>
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full py-4 rounded-xl font-black bg-brand-navy text-white">Add Entry</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
