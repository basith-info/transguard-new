import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { onAttendanceUpdated } from "../lib/events";
import {
  User,
  Briefcase,
  DollarSign,
  FileText,
  History,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  Calendar,
  Shield,
  Camera,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Wallet,
  X,
  Minus,
  CreditCard,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-8 py-4 border-b-2 transition-all font-black uppercase tracking-widest text-[10px] whitespace-nowrap ${active
      ? "border-brand-navy text-brand-navy bg-slate-50"
      : "border-transparent text-slate-400 hover:text-brand-navy hover:bg-slate-50"
      }`}
  >
    <Icon size={16} />
    <span>{label}</span>
  </button>
);

const SectionHeader = ({ title, description }: any) => (
  <div className="mb-8">
    <h3 className="text-xl font-black text-brand-navy tracking-tight">{title}</h3>
    <p className="text-sm font-medium text-slate-500">{description}</p>
  </div>
);

const InputField = ({ label, value, onChange, type = "text", disabled = false, options = null }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    {options ? (
      <select
        disabled={disabled}
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 disabled:opacity-50 appearance-none transition-all"
        value={value ?? ""}
        onChange={onChange}
      >
        {options.map((opt: any) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ) : (
      <input
        type={type}
        disabled={disabled}
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 disabled:opacity-50 transition-all"
        value={value ?? ""}
        onChange={onChange}
      />
    )}
  </div>
);

const STATUS_LABEL: Record<string, string> = {
  P: "Present",
  H: "Half Day",
  PL: "Paid Leave",
  PH: "Public Holiday",
};

export default function GuardProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal");
  const [guard, setGuard] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Payroll / ledger state
  const [payrollMonth, setPayrollMonth] = useState(startOfMonth(new Date()));
  const [monthAttendance, setMonthAttendance] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [payrollSubTab, setPayrollSubTab] = useState<"statement" | "settings">("statement");

  // Live server-side payroll summary (recalculated by server on every change)
  const [payrollSummary, setPayrollSummary] = useState<{
    basicSalary: number; totalAllowances: number; totalDeductions: number;
    netSalary: number; effectiveDays: number; presentDays: number;
    epfDeduction: number; advanceRecovery: number; foodDeduction: number; uniformDeduction: number;
  } | null>(null);

  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    new_basic_daily_rate: "",
    new_day_shift_rate: "",
    new_night_shift_rate: "",
    reason: "",
    applied_month: new Date().getMonth() + 1,
    applied_year: new Date().getFullYear()
  });

  const emptyEntry = () => ({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    reason: "",
    deduction_month: format(new Date(), "yyyy-MM"),
  });
  const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
  const [newDeduction, setNewDeduction] = useState(emptyEntry());
  const [isAllowanceModalOpen, setIsAllowanceModalOpen] = useState(false);
  const [newAllowance, setNewAllowance] = useState(emptyEntry());

  // Documents
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    label: "NIC Copy",
    file_name: "",
    upload_date: new Date().toISOString().split("T")[0],
  });

  // Stable ref so event listeners always call the latest version
  const fetchMonthAttendanceRef = useRef<() => Promise<void>>();

  useEffect(() => {
    fetchData();
  }, [id]);

  // Re-fetch attendance whenever month or tab changes
  useEffect(() => {
    if (activeTab === "payroll") fetchMonthAttendance();
  }, [payrollMonth, activeTab, id]);

  // Listen to attendance_updated events fired by Attendance page
  // Always re-fetch regardless of which tab is active — the ledger useMemo
  // will recompute instantly once state updates.
  useEffect(() => {
    const unsub = onAttendanceUpdated((updatedGuardId) => {
      if (!updatedGuardId || updatedGuardId === Number(id)) {
        // Fetch even if not on payroll tab so data is ready when they switch
        fetchMonthAttendanceRef.current?.();
      }
    });
    return unsub;
  }, [id]);

  // Re-fetch when user returns to this browser tab / window
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === "payroll") fetchMonthAttendanceRef.current?.();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && activeTab === "payroll") fetchMonthAttendanceRef.current?.();
    });
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gRes, cRes, aRes, dRes, hRes] = await Promise.all([
        fetch(`/api/guards/${id}`),
        fetch("/api/clients"),
        fetch(`/api/guards/${id}/advances`),
        fetch(`/api/guards/${id}/documents`),
        fetch(`/api/guards/${id}/history`),
      ]);
      const gData = await gRes.json();
      try {
        if (typeof gData.allowances === "string") gData.allowances = JSON.parse(gData.allowances);
        if (typeof gData.deductions === "string") gData.deductions = JSON.parse(gData.deductions);
      } catch { }
      if (!Array.isArray(gData.allowances)) gData.allowances = [];
      if (!Array.isArray(gData.deductions)) gData.deductions = [];
      setGuard(gData);
      setClients(await cRes.json());
      setAdvances(await aRes.json());
      setDocuments(await dRes.json());
      setHistory(await hRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthAttendance = useCallback(async () => {
    const month = payrollMonth.getMonth() + 1;
    const year = payrollMonth.getFullYear();
    setAttendanceLoading(true);
    try {
      const [attRes, advRes, sumRes] = await Promise.all([
        fetch(`/api/guards/${id}/attendance-month?month=${month}&year=${year}`),
        fetch(`/api/guards/${id}/advances`),
        fetch(`/api/guards/${id}/payroll-summary?month=${month}&year=${year}`),
      ]);
      const attData = await attRes.json();
      const advData = await advRes.json();
      const sumData = await sumRes.json();
      setMonthAttendance(Array.isArray(attData) ? attData : []);
      setAdvances(Array.isArray(advData) ? advData : []);
      if (!sumData.error) setPayrollSummary(sumData);
    } catch {
      setMonthAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  }, [id, payrollMonth]);

  const fetchSalaryHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/guards/${id}/salary-history`);
      const data = await res.json();
      setSalaryHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch salary history:", err);
    }
  }, [id]);

  useEffect(() => {
    fetchSalaryHistory();
  }, [fetchSalaryHistory]);

  const handlePrint = () => {
    window.print();
  };

  const handleSalaryChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/guards/${id}/salary-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...salaryForm,
          new_basic_daily_rate: Number(salaryForm.new_basic_daily_rate || guard.basic_daily_rate || 0),
          new_day_shift_rate: Number(salaryForm.new_day_shift_rate || guard.day_shift_rate || 0),
          new_night_shift_rate: Number(salaryForm.new_night_shift_rate || guard.night_shift_rate || 0),
          changed_by: "Admin"
        }),
      });
      if (res.ok) {
        setIsSalaryModalOpen(false);
        setSalaryForm({
          new_basic_daily_rate: "", new_day_shift_rate: "", new_night_shift_rate: "",
          reason: "", applied_month: new Date().getMonth() + 1, applied_year: new Date().getFullYear()
        });
        fetchData();
        fetchSalaryHistory();
        fetchMonthAttendance();
        alert("Salary updated and history recorded!");
      }
    } catch (err) {
      console.error("Salary change failed:", err);
    }
  };

  // Keep ref in sync so event listeners always call the latest version
  useEffect(() => {
    fetchMonthAttendanceRef.current = fetchMonthAttendance;
  }, [fetchMonthAttendance]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...guard,
      allowances: JSON.stringify(guard.allowances || []),
      deductions: JSON.stringify(guard.deductions || []),
    };
    await fetch(`/api/guards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    alert("Profile updated successfully!");
    fetchData();
  };


  /**
   * Optimistically add an allowance or deduction:
   * 1. Immediately append a temporary entry to local `advances` state so the ledger
   *    re-renders at once (no wait for server).
   * 2. POST to server in the background.
   * 3. Replace the temporary entry with the real one returned by the server (re-fetch).
   * 4. Also trigger a payroll re-calc on the server side via the attendance-month refetch.
   */
  const postEntry = async (entry: typeof newDeduction, type: "deduction" | "allowance") => {
    // --- Step 1: optimistic local update ---
    const tempId = Date.now(); // temporary client-only id
    const optimisticEntry = {
      id: tempId,
      guard_id: Number(id),
      date: entry.date,
      amount: Number(entry.amount),
      reason: entry.reason,
      deduction_month: entry.deduction_month,
      type,
      _optimistic: true,
    };
    setAdvances((prev: any[]) => [optimisticEntry, ...prev]);

    // --- Step 2: server POST ---
    try {
      const res = await fetch(`/api/guards/${id}/advances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: entry.date,
          amount: Number(entry.amount),
          reason: entry.reason,
          deduction_month: entry.deduction_month,
          type,
        }),
      });
      const data = await res.json();
      // Replace temp id with real server id so the delete button works correctly
      if (data.id) {
        setAdvances((prev: any[]) => prev.map((a: any) =>
          a.id === tempId ? { ...a, id: data.id, _optimistic: false } : a
        ));
      }
      // --- Step 3: sync attendance + advances + payroll summary ---
      await fetchMonthAttendance();
    } catch (err) {
      // Rollback on error
      setAdvances((prev: any[]) => prev.filter((a: any) => a.id !== tempId));
      console.error("Failed to save entry:", err);
    }
  };

  const handleAddDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeductionModalOpen(false);
    setNewDeduction(emptyEntry());
    await postEntry(newDeduction, "deduction");
  };

  const handleAddAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAllowanceModalOpen(false);
    setNewAllowance(emptyEntry());
    await postEntry(newAllowance, "allowance");
  };

  const handleDeleteEntry = async (advId: number) => {
    if (!confirm("Remove this entry?")) return;
    // Optimistically remove from local state immediately
    setAdvances((prev: any[]) => prev.filter((a: any) => a.id !== advId));
    try {
      await fetch(`/api/guards/${id}/advances/${advId}`, { method: "DELETE" });
      // Sync real data in background
      fetchMonthAttendance();
    } catch (err) {
      // Rollback: re-fetch to restore
      fetchMonthAttendance();
    }
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/guards/${id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDoc),
    });
    setIsDocModalOpen(false);
    fetchData();
  };

  // Build bank-statement ledger for the selected month
  const ledger = useMemo(() => {
    if (!guard) return { entries: [], totalEarned: 0, totalDeductions: 0, netBalance: 0 };

    const dayRate = guard.day_shift_rate || guard.basic_daily_rate || 0;
    const nightRate = guard.night_shift_rate || guard.basic_daily_rate || 0;
    const selectedMonthStr = format(payrollMonth, "yyyy-MM");

    const entries: Array<{
      id: string;
      date: string;
      description: string;
      credit: number;
      debit: number;
      type: "credit" | "debit";
      tag: string;
      rawId?: number;
    }> = [];

    // Credits: from attendance (always include, even if rate = 0)
    monthAttendance.forEach((att) => {
      if (!["P", "H", "PL", "PH"].includes(att.status)) return;
      const isNight = att.template_name?.toLowerCase().includes("night");
      const rate = isNight ? nightRate : dayRate;
      const multiplier = att.status === "H" ? 0.5 : 1;
      const amount = rate * multiplier;
      const shiftLabel = att.template_name || "Day Shift";
      const noRate = rate <= 0;
      entries.push({
        id: `att-${att.id}`,
        date: att.date,
        description: `${STATUS_LABEL[att.status] || att.status} — ${shiftLabel}${noRate ? " (rate not set)" : ""}`,
        credit: amount,
        debit: 0,
        type: "credit",
        tag: att.status,
        noRate,
      } as any);
    });

    // Debits + Allowances from advances table
    advances
      .filter((adv) => {
        if (adv.deduction_month) return adv.deduction_month === selectedMonthStr;
        return adv.date?.startsWith(selectedMonthStr);
      })
      .forEach((adv) => {
        const isAllowance = adv.type === "allowance";
        entries.push({
          id: `adv-${adv.id}`,
          date: adv.date,
          description: adv.reason || (isAllowance ? "Allowance" : "Advance / Deduction"),
          credit: isAllowance ? adv.amount : 0,
          debit: isAllowance ? 0 : adv.amount,
          type: isAllowance ? "credit" : "debit",
          tag: isAllowance ? "ALLOWANCE" : "DEBIT",
          rawId: adv.id,
        });
      });

    // Sort chronologically
    entries.sort((a, b) => {
      if (a.date === b.date) return a.type === "credit" ? -1 : 1;
      return a.date.localeCompare(b.date);
    });

    // Running balance
    let balance = 0;
    const withBalance = entries.map((e) => {
      balance += e.credit - e.debit;
      return { ...e, balance };
    });

    const totalAttendance = entries.filter(e => e.tag !== "ALLOWANCE").reduce((s, e) => s + e.credit, 0);
    const totalAllowances = entries.filter(e => e.tag === "ALLOWANCE").reduce((s, e) => s + e.credit, 0);
    const totalEarned = totalAttendance + totalAllowances;
    const totalDeductions = entries.reduce((s, e) => s + e.debit, 0);

    return { entries: withBalance, totalEarned, totalAttendance, totalAllowances, totalDeductions, netBalance: totalEarned - totalDeductions };
  }, [guard, monthAttendance, advances, payrollMonth]);

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Loading profile...</div>;
  if (!guard) return <div className="text-center py-20 text-slate-500">Guard not found.</div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/guards")}
          className="flex items-center gap-2 text-slate-400 hover:text-brand-navy transition-colors font-bold"
        >
          <ArrowLeft size={20} />
          <span>Back to Guard List</span>
        </button>
        <div className="flex gap-4">
          <button className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 hover:bg-slate-50">
            <Download size={18} />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleUpdate}
            className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-navy/20 flex items-center gap-2"
          >
            <Save size={18} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10 shadow-sm">
        <div className="relative group">
          <div className="w-40 h-40 rounded-[2.5rem] bg-slate-100 border-4 border-white flex items-center justify-center text-brand-navy text-5xl font-black overflow-hidden shadow-inner">
            {guard.profile_photo ? (
              <img src={guard.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              guard.full_name.charAt(0)
            )}
          </div>
          <button className="absolute -bottom-2 -right-2 bg-brand-navy p-3 rounded-2xl text-white shadow-xl hover:scale-110 transition-transform">
            <Camera size={20} />
          </button>
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <h1 className="text-4xl font-black text-brand-navy tracking-tight">{guard.full_name}</h1>
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit mx-auto md:mx-0 ${guard.status === "Active" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
              {guard.status}
            </span>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-6 text-slate-500 font-bold">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-slate-300" />
              <span>
                ID:{" "}
                {guard.guard_type === "Temporary"
                  ? guard.nic ? `TGST-${String(guard.id).padStart(4, "0")}` : "TEM"
                  : guard.guard_type === "Office" ? `TGO-${String(guard.id).padStart(4, "0")}`
                    : guard.guard_type === "Volunteer" ? `TGV-${String(guard.id).padStart(4, "0")}`
                      : `TGS-${String(guard.id).padStart(4, "0")}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Briefcase size={18} className="text-slate-300" />
              <span>{guard.designation || guard.rank || "Guard"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-slate-300" />
              <span>Joined: {guard.joined_date}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="flex overflow-x-auto border-b border-slate-100 no-scrollbar bg-slate-50/30">
          <TabButton active={activeTab === "personal"} onClick={() => setActiveTab("personal")} icon={User} label="Personal" />
          <TabButton active={activeTab === "employment"} onClick={() => setActiveTab("employment")} icon={Briefcase} label="Employment" />
          <TabButton active={activeTab === "payroll"} onClick={() => { setActiveTab("payroll"); }} icon={Wallet} label="Payroll" />
          <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")} icon={FileText} label="Documents" />
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} icon={History} label="History" />
        </div>

        <div className="p-8 md:p-10">

          {/* ── PERSONAL ── */}
          {activeTab === "personal" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SectionHeader title="Personal Information" description="Basic identity and contact details" />
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InputField label="Full Name" value={guard.full_name} onChange={(e: any) => setGuard({ ...guard, full_name: e.target.value })} />
                <InputField label="Guard Type" value={guard.guard_type} options={["Regular", "Temporary", "Office", "Volunteer"]} onChange={(e: any) => setGuard({ ...guard, guard_type: e.target.value })} />
                <InputField label="Rank / Designation" value={guard.rank || ""} options={["SSO", "SO", "Guard", "Supervisor", "Office Staff"]} onChange={(e: any) => setGuard({ ...guard, rank: e.target.value })} />
                <InputField label="NIC Number" value={guard.nic} onChange={(e: any) => setGuard({ ...guard, nic: e.target.value })} />
                <InputField label="Passport Number" value={guard.passport || ""} onChange={(e: any) => setGuard({ ...guard, passport: e.target.value })} />
                <InputField label="Date of Birth" type="date" value={guard.dob} onChange={(e: any) => setGuard({ ...guard, dob: e.target.value })} />
                <InputField label="Gender" value={guard.gender} options={["Male", "Female", "Other"]} onChange={(e: any) => setGuard({ ...guard, gender: e.target.value })} />
                <InputField label="Blood Group" value={guard.blood_group || ""} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} onChange={(e: any) => setGuard({ ...guard, blood_group: e.target.value })} />
                <InputField label="Phone Number" value={guard.phone} onChange={(e: any) => setGuard({ ...guard, phone: e.target.value })} />
                <InputField label="Emergency Contact Name" value={guard.emergency_contact_name || ""} onChange={(e: any) => setGuard({ ...guard, emergency_contact_name: e.target.value })} />
                <InputField label="Emergency Contact Phone" value={guard.emergency_contact_phone || ""} onChange={(e: any) => setGuard({ ...guard, emergency_contact_phone: e.target.value })} />
                <div className="md:col-span-2">
                  <InputField label="Permanent Address" value={guard.permanent_address || ""} onChange={(e: any) => setGuard({ ...guard, permanent_address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <InputField label="Current Address" value={guard.current_address || ""} onChange={(e: any) => setGuard({ ...guard, current_address: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* ── EMPLOYMENT ── */}
          {activeTab === "employment" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SectionHeader title="Employment Details" description="Current role and assignment status" />
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InputField label="Date Joined" type="date" value={guard.joined_date} onChange={(e: any) => setGuard({ ...guard, joined_date: e.target.value })} />
                  <InputField label="Designation / Rank" value={guard.designation} onChange={(e: any) => setGuard({ ...guard, designation: e.target.value })} />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Client / Site</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 appearance-none transition-all"
                      value={guard.client_id || ""}
                      onChange={(e: any) => setGuard({ ...guard, client_id: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <InputField label="Employment Status" value={guard.status} options={["Active", "Inactive", "On Paid Leave", "Resigned", "Terminated"]} onChange={(e: any) => setGuard({ ...guard, status: e.target.value })} />
                </div>
              </div>
              {(guard.status === "Resigned" || guard.status === "Terminated") && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
                  <InputField label="Resignation/Termination Date" type="date" value={guard.resigned_date || ""} onChange={(e: any) => setGuard({ ...guard, resigned_date: e.target.value })} />
                  <InputField label="Reason" value={guard.resigned_reason || ""} onChange={(e: any) => setGuard({ ...guard, resigned_reason: e.target.value })} />
                </motion.div>
              )}
              {guard.status === "On Paid Leave" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                  <InputField label="Leave Start Date" type="date" value={guard.leave_start_date || ""} onChange={(e: any) => setGuard({ ...guard, leave_start_date: e.target.value })} />
                  <InputField label="Expected Return Date" type="date" value={guard.leave_expected_return_date || ""} onChange={(e: any) => setGuard({ ...guard, leave_expected_return_date: e.target.value })} />
                </motion.div>
              )}
            </div>
          )}

          {/* ── PAYROLL (bank statement) ── */}
          {activeTab === "payroll" && (
            <div className="space-y-8">

              {/* ── Live Payroll Summary Banner ── */}
              {payrollSummary && (
                <div className={`rounded-[2rem] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${payrollSummary.netSalary >= 0 ? "bg-brand-navy" : "bg-red-700"
                  } text-white shadow-xl`}>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">
                      {format(payrollMonth, "MMMM yyyy")} — Live Payroll Total
                    </p>
                    <p className={`text-4xl font-black tracking-tight ${attendanceLoading ? "opacity-60" : ""}`}>
                      {payrollSummary.netSalary < 0 ? "−" : ""}LKR {Math.abs(payrollSummary.netSalary).toLocaleString()}
                      {attendanceLoading && <span className="ml-3 text-base font-bold text-white/50 animate-pulse">updating…</span>}
                    </p>
                    <p className="text-[10px] font-medium text-white/50 mt-1">Net take-home · synced live from attendance</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    {[
                      { label: "Attendance Pay", val: payrollSummary.basicSalary, color: "text-emerald-300" },
                      { label: "Allowances", val: payrollSummary.totalAllowances, color: "text-sky-300" },
                      { label: "Deductions", val: payrollSummary.totalDeductions, color: "text-red-300" },
                      { label: "Days Present", val: payrollSummary.presentDays, color: "text-white", suffix: " days" },
                    ].map(({ label, val, color, suffix }) => (
                      <div key={label} className="bg-white/10 rounded-2xl px-4 py-3 min-w-[110px]">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">{label}</p>
                        <p className={`text-lg font-black ${color}`}>
                          {suffix ? val : `LKR ${val.toLocaleString()}`}{suffix ?? ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tab switcher */}
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                <button
                  onClick={() => setPayrollSubTab("statement")}
                  className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${payrollSubTab === "statement" ? "bg-white shadow-sm text-brand-navy" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Account Statement
                </button>
                <button
                  onClick={() => setPayrollSubTab("settings")}
                  className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${payrollSubTab === "settings" ? "bg-white shadow-sm text-brand-navy" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Salary Settings
                </button>
              </div>

              {/* ── ACCOUNT STATEMENT ── */}
              {payrollSubTab === "statement" && (
                <div className="space-y-8">
                  {/* Month navigator */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
                    {/* Left: title + live badge */}
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-black text-brand-navy tracking-tight">Pay Account</h3>
                        {attendanceLoading ? (
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Syncing…
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Live
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">All earnings and deductions — like a bank statement</p>
                    </div>
                    {/* Right: month nav + action buttons */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <button onClick={() => setPayrollMonth(subMonths(payrollMonth, 1))} className="px-4 py-3 hover:bg-slate-50 text-slate-400 hover:text-brand-navy transition-all">
                          <ChevronLeft size={18} />
                        </button>
                        <div className="px-6 font-black text-brand-navy text-xs uppercase tracking-widest min-w-[140px] text-center">
                          {format(payrollMonth, "MMMM yyyy")}
                        </div>
                        <button onClick={() => setPayrollMonth(addMonths(payrollMonth, 1))} className="px-4 py-3 hover:bg-slate-50 text-slate-400 hover:text-brand-navy transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                      <button
                        onClick={handlePrint}
                        className="bg-white border border-slate-200 text-slate-500 hover:text-brand-navy hover:border-brand-navy px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-sm"
                      >
                        <Download size={14} />
                        Print Statement
                      </button>
                      <button
                        onClick={() => fetchMonthAttendance()}
                        className="bg-white border border-slate-200 text-slate-500 hover:text-brand-navy hover:border-brand-navy px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-sm"
                        title="Refresh to sync latest attendance"
                      >
                        <RefreshCw size={14} className={attendanceLoading ? "animate-spin" : ""} />
                        Refresh
                      </button>
                      <button
                        onClick={() => setIsAllowanceModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <Plus size={14} />
                        Add Allowance
                      </button>
                      <button
                        onClick={() => setIsDeductionModalOpen(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
                      >
                        <Minus size={14} />
                        Add Deduction
                      </button>
                    </div>
                  </div>

                  {/* Rates-missing warning */}
                  {(!guard.day_shift_rate && !guard.basic_daily_rate && !guard.night_shift_rate) && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                      <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-black text-amber-700">Daily rate not set — attendance credits will show as LKR 0</p>
                        <p className="text-xs font-medium text-amber-600 mt-0.5">
                          Go to the <button onClick={() => setPayrollSubTab("settings")} className="underline font-black">Salary Settings</button> tab and enter the Day Shift Rate (or Basic Daily Rate) to enable automatic earnings calculation.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Balance summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Net balance — prominent */}
                    <div className={`col-span-2 md:col-span-1 rounded-[2rem] p-7 flex flex-col justify-between ${ledger.netBalance >= 0 ? "bg-brand-navy" : "bg-red-600"} text-white`}>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Net Balance</p>
                        <Wallet size={20} className="text-white/40" />
                      </div>
                      <div>
                        <p className={`text-3xl font-black tracking-tight ${ledger.netBalance < 0 ? "text-red-200" : ""}`}>
                          {ledger.netBalance < 0 ? "− " : ""}LKR {Math.abs(ledger.netBalance).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mt-1">
                          {format(payrollMonth, "MMMM yyyy")} · End-of-month
                        </p>
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-6 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Attendance Pay</p>
                        <TrendingUp size={16} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-emerald-700 tracking-tight">LKR {(ledger.totalAttendance || 0).toLocaleString()}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 mt-1">
                          {ledger.entries.filter((e) => e.tag !== "ALLOWANCE" && e.type === "credit").length} days
                        </p>
                      </div>
                    </div>
                    <div className="bg-sky-50 border border-sky-100 rounded-[2rem] p-6 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-600/70">Allowances</p>
                        <Plus size={16} className="text-sky-400" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-sky-700 tracking-tight">LKR {(ledger.totalAllowances || 0).toLocaleString()}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-500/60 mt-1">
                          {ledger.entries.filter((e) => e.tag === "ALLOWANCE").length} entries
                        </p>
                      </div>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-[2rem] p-6 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-600/70">Deductions</p>
                        <TrendingDown size={16} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-xl font-black text-red-700 tracking-tight">LKR {ledger.totalDeductions.toLocaleString()}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500/60 mt-1">
                          {ledger.entries.filter((e) => e.type === "debit").length} entries
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ledger table */}
                  <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-3">
                      <CreditCard size={18} className="text-brand-navy/40" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-navy">Transaction Ledger — {format(payrollMonth, "MMMM yyyy")}</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] uppercase tracking-widest font-black text-slate-400">
                            <th className="px-8 py-4 w-32">Date</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 text-right text-emerald-600">Credit (+)</th>
                            <th className="px-6 py-4 text-right text-red-500">Debit (−)</th>
                            <th className="px-8 py-4 text-right">Balance</th>
                            <th className="px-4 py-4 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {ledger.entries.map((entry) => (
                            <tr
                              key={entry.id}
                              className={`transition-colors ${entry.type === "debit"
                                ? "hover:bg-red-50/40"
                                : entry.tag === "ALLOWANCE"
                                  ? "hover:bg-sky-50/30"
                                  : "hover:bg-emerald-50/30"
                                }`}
                            >
                              <td className="px-8 py-4 text-xs font-black text-slate-500 whitespace-nowrap">
                                {entry.date}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${entry.type === "debit" ? "bg-red-400" : entry.tag === "ALLOWANCE" ? "bg-sky-400" : "bg-emerald-400"
                                    }`} />
                                  <div>
                                    <span className={`text-sm font-bold ${entry.type === "debit" ? "text-red-700" : entry.tag === "ALLOWANCE" ? "text-sky-700" : "text-slate-700"
                                      }`}>
                                      {entry.description}
                                    </span>
                                    {entry.tag === "ALLOWANCE" && (
                                      <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-sky-500 bg-sky-100 px-2 py-0.5 rounded-full">Allowance</span>
                                    )}
                                    {entry.tag === "DEBIT" && (
                                      <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-100 px-2 py-0.5 rounded-full">Deduction</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                {entry.type === "credit" && (
                                  (entry as any).noRate ? (
                                    <span className="text-xs font-bold text-amber-500 italic">Set rate →</span>
                                  ) : (
                                    <span className={`text-sm font-black ${entry.tag === "ALLOWANCE" ? "text-sky-600" : "text-emerald-600"}`}>
                                      + {entry.credit.toLocaleString()}
                                    </span>
                                  )
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {entry.debit > 0 && (
                                  <span className="text-sm font-black text-red-600">
                                    − {entry.debit.toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td className="px-8 py-4 text-right">
                                <span className={`text-sm font-black ${entry.balance >= 0 ? "text-brand-navy" : "text-red-600"}`}>
                                  {entry.balance < 0 ? "−" : ""} {Math.abs(entry.balance).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                {entry.rawId && (
                                  <button
                                    onClick={() => handleDeleteEntry(entry.rawId!)}
                                    className={`p-1.5 rounded-lg transition-all ${entry.type === "debit"
                                      ? "text-slate-200 hover:text-red-500 hover:bg-red-50"
                                      : "text-slate-200 hover:text-sky-500 hover:bg-sky-50"
                                      }`}
                                    title="Remove this entry"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {ledger.entries.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-4 text-slate-400">
                                  <div className="bg-slate-50 p-6 rounded-full">
                                    <Wallet size={40} className="opacity-20" />
                                  </div>
                                  <p className="font-black text-base">No attendance recorded for {format(payrollMonth, "MMMM yyyy")}</p>
                                  <p className="text-sm font-medium">Mark this guard as Present (P) in the Attendance page — entries will appear here automatically.</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {ledger.entries.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-50 border-t-2 border-slate-200">
                              <td colSpan={2} className="px-8 py-5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">End of Month Total</span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className="text-base font-black text-emerald-600">+ {ledger.totalEarned.toLocaleString()}</span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className="text-base font-black text-red-600">− {ledger.totalDeductions.toLocaleString()}</span>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <span className={`text-base font-black ${ledger.netBalance >= 0 ? "text-brand-navy" : "text-red-600"}`}>
                                  {ledger.netBalance < 0 ? "−" : ""} LKR {Math.abs(ledger.netBalance).toLocaleString()}
                                </span>
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SALARY SETTINGS ── */}
              {payrollSubTab === "settings" && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <InputField label="Day Shift Rate (LKR)" type="number" value={guard.day_shift_rate || ""} onChange={(e: any) => setGuard({ ...guard, day_shift_rate: Number(e.target.value) })} />
                    <InputField label="Night Shift Rate (LKR)" type="number" value={guard.night_shift_rate || ""} onChange={(e: any) => setGuard({ ...guard, night_shift_rate: Number(e.target.value) })} />
                    <InputField label="Basic Daily Rate (LKR)" type="number" value={guard.basic_daily_rate} onChange={(e: any) => setGuard({ ...guard, basic_daily_rate: Number(e.target.value) })} />
                    <InputField label="Monthly Basic Salary (LKR)" type="number" value={guard.monthly_basic_salary || ""} onChange={(e: any) => setGuard({ ...guard, monthly_basic_salary: Number(e.target.value) })} />
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EPF/ETF Enrolled</label>
                      <div className="flex items-center gap-6 h-12">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" checked={guard.epf_enrolled === 1} onChange={() => setGuard({ ...guard, epf_enrolled: 1 })} className="w-5 h-5 text-brand-navy border-slate-300" />
                          <span className="text-sm font-bold text-brand-navy">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input type="radio" checked={guard.epf_enrolled === 0} onChange={() => setGuard({ ...guard, epf_enrolled: 0 })} className="w-5 h-5 text-brand-navy border-slate-300" />
                          <span className="text-sm font-bold text-brand-navy">No</span>
                        </label>
                      </div>
                    </div>
                    {guard.epf_enrolled === 1 && (
                      <>
                        <InputField label="EPF Employee Rate (%)" type="number" value={guard.epf_rate || 8} onChange={(e: any) => setGuard({ ...guard, epf_rate: Number(e.target.value) })} />
                        <InputField label="ETF Employer Rate (%)" type="number" value={guard.etf_rate || 3} onChange={(e: any) => setGuard({ ...guard, etf_rate: Number(e.target.value) })} />
                      </>
                    )}
                    <InputField label="Uniform Deduction (Total)" type="number" value={guard.uniform_deduction_amount || ""} onChange={(e: any) => setGuard({ ...guard, uniform_deduction_amount: Number(e.target.value) })} />
                    <InputField label="Installments" type="number" value={guard.uniform_installments || ""} onChange={(e: any) => setGuard({ ...guard, uniform_installments: Number(e.target.value) })} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-slate-100 pt-8">
                    {/* Allowances */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between opacity-0 h-0 overflow-hidden">
                        <h4 className="text-base font-black text-brand-navy tracking-tight">Other Allowances</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="hidden">
                          {guard.allowances?.map((a: any, idx: number) => (
                            <div key={idx} />
                          ))}
                        </div>
                        {(!guard.allowances || guard.allowances.length === 0) && <p className="text-xs text-slate-400 italic">No custom allowances.</p>}
                      </div>
                    </div>
                    {/* Fixed Deductions */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between opacity-0 h-0 overflow-hidden">
                        <h4 className="text-base font-black text-brand-navy tracking-tight">Fixed Deductions</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="hidden">
                          {guard.deductions?.map((d: any, idx: number) => (
                            <div key={idx} />
                          ))}
                        </div>
                        {(!guard.deductions || guard.deductions.length === 0) && <p className="text-xs text-slate-400 italic">No fixed deductions.</p>}
                      </div>
                    </div>

                    {/* ── RATE HISTORY TIMELINE ── */}
                    <div className="border-t border-slate-100 pt-10 mt-10">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h4 className="text-base font-black text-brand-navy tracking-tight">Salary Rate History</h4>
                          <p className="text-xs text-slate-500 font-medium">Record of all salary increments and changes</p>
                        </div>
                        <button
                          onClick={() => setIsSalaryModalOpen(true)}
                          className="bg-brand-navy hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all shadow-lg shadow-brand-navy/20"
                        >
                          <Plus size={14} />
                          Increase / Change Salary
                        </button>
                      </div>

                      <div className="relative space-y-6 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {salaryHistory.map((h: any) => (
                          <div key={h.id} className="relative pl-14">
                            <div className="absolute left-3.5 top-2 w-3.5 h-3.5 rounded-full bg-emerald-500 border-4 border-white shadow-sm"></div>
                            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <p className="text-sm font-black text-brand-navy">Salary Updated — {h.reason || "Increment"}</p>
                                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Changed on {format(new Date(h.change_date), "MMM d, yyyy")} · by {h.changed_by}</p>
                                </div>
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  Applied: {h.applied_month}/{h.applied_year}
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                {[
                                  { label: "Basic Rate", old: h.previous_basic_daily_rate, new: h.new_basic_daily_rate },
                                  { label: "Day Shift", old: h.previous_day_shift_rate, new: h.new_day_shift_rate },
                                  { label: "Night Shift", old: h.previous_night_shift_rate, new: h.new_night_shift_rate }
                                ].map((item: any) => (
                                  <div key={item.label}>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-400 line-through">LKR {item.old || 0}</span>
                                      <ArrowRight size={10} className="text-slate-300" />
                                      <span className="text-xs font-black text-emerald-600">LKR {item.new}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                        {salaryHistory.length === 0 && (
                          <div className="py-10 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-100">
                            <p className="text-sm text-slate-400 font-medium italic">No salary change history recorded yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === "documents" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-8">
                <SectionHeader title="Document Uploads" description="Manage certificates and ID copies" />
                <button onClick={() => setIsDocModalOpen(true)}
                  className="bg-brand-navy hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-brand-navy/20 flex items-center gap-2 transition-all">
                  <Plus size={18} /><span>Upload Document</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-white border border-slate-100 p-6 rounded-3xl flex items-center gap-5 group hover:border-brand-navy/20 hover:shadow-md transition-all">
                    <div className="bg-slate-50 p-4 rounded-2xl text-brand-navy"><FileText size={28} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-brand-navy truncate">{doc.label}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{doc.upload_date}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy transition-colors"><Download size={18} /></button>
                      <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
                {documents.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-slate-400">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><FileText size={40} className="opacity-20" /></div>
                    <p className="font-bold">No documents uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── HISTORY ── */}
          {activeTab === "history" && (
            <div className="space-y-6">
              <SectionHeader title="Activity Log" description="History of status changes and assignments" />
              <div className="relative space-y-6 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {history.map((h) => (
                  <div key={h.id} className="relative pl-14">
                    <div className="absolute left-3.5 top-2 w-3.5 h-3.5 rounded-full bg-brand-navy border-4 border-white shadow-sm"></div>
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-black text-brand-navy">Status changed to {h.new_status}</p>
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{format(new Date(h.changed_at), "MMM d, yyyy HH:mm")}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 mb-3">Changed by {h.changed_by}</p>
                      {h.reason && <p className="text-xs font-medium text-slate-500 italic bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">"{h.reason}"</p>}
                    </div>
                  </div>
                ))}
                {history.length === 0 && <div className="text-center py-12 text-slate-400 italic text-sm font-medium">No activity history found.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Deduction Modal */}
      <AnimatePresence>
        {isDeductionModalOpen && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-brand-navy tracking-tight">Add Deduction</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Will show as a red minus in the account statement</p>
                </div>
                <button onClick={() => setIsDeductionModalOpen(false)} className="text-slate-400 hover:text-brand-navy transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddDeduction} className="p-8 space-y-5">
                <InputField label="Date" type="date" value={newDeduction.date} onChange={(e: any) => setNewDeduction({ ...newDeduction, date: e.target.value })} />
                <InputField label="Amount (LKR)" type="number" value={newDeduction.amount} onChange={(e: any) => setNewDeduction({ ...newDeduction, amount: e.target.value })} />
                <InputField label="Reason / Description" value={newDeduction.reason} onChange={(e: any) => setNewDeduction({ ...newDeduction, reason: e.target.value })} />
                <InputField label="Deduct from Month" type="month" value={newDeduction.deduction_month} onChange={(e: any) => setNewDeduction({ ...newDeduction, deduction_month: e.target.value })} />
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsDeductionModalOpen(false)} className="px-6 py-2.5 font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-red-600/20 transition-all flex items-center gap-2">
                    <Minus size={14} /> Save Deduction
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Allowance Modal */}
      <AnimatePresence>
        {isAllowanceModalOpen && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-brand-navy tracking-tight">Add Allowance</h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Will show as a blue credit in the account statement</p>
                </div>
                <button onClick={() => setIsAllowanceModalOpen(false)} className="text-slate-400 hover:text-brand-navy transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddAllowance} className="p-8 space-y-5">
                <InputField label="Date" type="date" value={newAllowance.date} onChange={(e: any) => setNewAllowance({ ...newAllowance, date: e.target.value })} />
                <InputField label="Amount (LKR)" type="number" value={newAllowance.amount} onChange={(e: any) => setNewAllowance({ ...newAllowance, amount: e.target.value })} />
                <InputField label="Reason / Description" value={newAllowance.reason} onChange={(e: any) => setNewAllowance({ ...newAllowance, reason: e.target.value })} />
                <InputField label="Apply to Month" type="month" value={newAllowance.deduction_month} onChange={(e: any) => setNewAllowance({ ...newAllowance, deduction_month: e.target.value })} />
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsAllowanceModalOpen(false)} className="px-6 py-2.5 font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-emerald-600/20 transition-all flex items-center gap-2">
                    <Plus size={14} /> Save Allowance
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Increase/Change Salary Modal */}
      <AnimatePresence>
        {isSalaryModalOpen && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-brand-navy tracking-tight">Update Salary Rates</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Change rates and record an increment history entry</p>
                </div>
                <button onClick={() => setIsSalaryModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleSalaryChange} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField label="New Basic Daily Rate" type="number" placeholder={guard.basic_daily_rate.toString()} value={salaryForm.new_basic_daily_rate} onChange={(e: any) => setSalaryForm({ ...salaryForm, new_basic_daily_rate: e.target.value })} />
                  <InputField label="New Day Shift Rate" type="number" placeholder={(guard.day_shift_rate || guard.basic_daily_rate).toString()} value={salaryForm.new_day_shift_rate} onChange={(e: any) => setSalaryForm({ ...salaryForm, new_day_shift_rate: e.target.value })} />
                  <InputField label="New Night Shift Rate" type="number" placeholder={(guard.night_shift_rate || guard.basic_daily_rate).toString()} value={salaryForm.new_night_shift_rate} onChange={(e: any) => setSalaryForm({ ...salaryForm, new_night_shift_rate: e.target.value })} />
                  <InputField label="Update Reason" placeholder="e.g. Annual Increment" value={salaryForm.reason} onChange={(e: any) => setSalaryForm({ ...salaryForm, reason: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Effective Month</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-14 text-sm font-bold focus:outline-none" value={salaryForm.applied_month} onChange={(e) => setSalaryForm({ ...salaryForm, applied_month: Number(e.target.value) })}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{format(new Date(2026, i, 1), "MMMM")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Effective Year</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-14 text-sm font-bold focus:outline-none" value={salaryForm.applied_year} onChange={(e) => setSalaryForm({ ...salaryForm, applied_year: Number(e.target.value) })}>
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setIsSalaryModalOpen(false)} className="px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                  <button type="submit" className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">Save Changes & History</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Modal */}
      <AnimatePresence>
        {isDocModalOpen && (
          <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-brand-navy tracking-tight">Upload Document</h3>
                <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-brand-navy transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddDoc} className="p-8 space-y-5">
                <InputField label="Document Label" value={newDoc.label} options={["Birth Certificate", "NIC Copy", "Police Clearance", "Medical Certificate", "Passport Copy", "Other"]} onChange={(e: any) => setNewDoc({ ...newDoc, label: e.target.value })} />
                <InputField label="File Name" value={newDoc.file_name} onChange={(e: any) => setNewDoc({ ...newDoc, file_name: e.target.value })} />
                <InputField label="Upload Date" type="date" value={newDoc.upload_date} onChange={(e: any) => setNewDoc({ ...newDoc, upload_date: e.target.value })} />
                <div className="flex justify-end gap-4 pt-4">
                  <button type="button" onClick={() => setIsDocModalOpen(false)} className="px-6 py-2.5 font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-brand-navy/20 transition-all">Upload</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
