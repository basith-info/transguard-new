import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Download, CheckCircle2, AlertCircle, FileText, Printer,
  Search, Calendar as CalendarIcon, DollarSign, Edit3, Save, X, ShieldCheck,
  CreditCard, Zap, Eye, RotateCcw, StickyNote
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";

const StatCard = ({ label, value, icon: Icon, colorClass }: any) => (
  <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={22} className={colorClass.replace("bg-", "text-")} />
      </div>
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monthly</span>
    </div>
    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
    <h3 className="text-xl font-black text-brand-navy tracking-tight">{value}</h3>
  </div>
);

export default function Payroll() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Draft" | "Approved" | "Adjusted">("All");
  const [sortBy, setSortBy] = useState<"name" | "net" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [viewingPayslip, setViewingPayslip] = useState<any>(null);
  const [unapproveRecord, setUnapproveRecord] = useState<any>(null);
  const [unapproveReason, setUnapproveReason] = useState("");
  const [recalcConfirm, setRecalcConfirm] = useState(false);
  const payslipRef = useRef<HTMLDivElement>(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
      const data = await res.json();
      setPayrollData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleGeneratePayroll = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const result = await res.json();
      if (result.success) {
        if (result.message) alert(result.message);
        await fetchPayroll();
      } else {
        alert("Failed: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!recalcConfirm) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payroll/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const result = await res.json();
      if (result.success) {
        setRecalcConfirm(false);
        await fetchPayroll();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`/api/payroll/${editingRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manual_adjustment: editingRecord.manual_adjustment,
          adjustment_reason: editingRecord.adjustment_reason,
        }),
      });
      setEditingRecord(null);
      fetchPayroll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await fetch(`/api/payroll/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });
      fetchPayroll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnapprove = async () => {
    if (!unapproveRecord) return;
    try {
      await fetch(`/api/payroll/${unapproveRecord.id}/unapprove`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unapproveReason }),
      });
      setUnapproveRecord(null);
      setUnapproveReason("");
      fetchPayroll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveAll = async () => {
    if (!confirm("Approve all draft payroll records for this month?")) return;
    try {
      await fetch("/api/payroll/approve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      fetchPayroll();
    } catch (err) {
      console.error(err);
    }
  };

  const downloadPayslipPDF = (pay: any) => {
    const doc = new jsPDF();
    const y = 20;
    doc.setFontSize(18);
    doc.text("TRANSGUARD — Salary Payslip", 20, y);
    doc.setFontSize(10);
    doc.text(`${format(currentDate, "MMMM yyyy")}`, 20, y + 8);
    doc.text(`Employee: ${pay.full_name}`, 20, y + 16);
    doc.text(`Designation: ${pay.rank || pay.designation || "Guard"}`, 20, y + 22);
    doc.text(`NIC: ${pay.nic || "—"}`, 20, y + 28);
    doc.text(`Basic Salary: LKR ${(pay.basic_salary ?? 0).toLocaleString()}`, 20, y + 36);
    doc.text(`Deductions: LKR ${((pay.epf_deduction ?? 0) + (pay.uniform_deduction ?? 0) + (pay.advance_recovery ?? 0) + (pay.food_deduction ?? 0)).toLocaleString()}`, 20, y + 42);
    doc.text(`Net Salary: LKR ${(pay.net_salary ?? 0).toLocaleString()}`, 20, y + 50);
    doc.save(`payslip-${pay.full_name?.replace(/\s/g, "-")}-${format(currentDate, "yyyy-MM")}.pdf`);
  };

  const handleBulkDownload = async () => {
    for (const pay of filteredPayroll) {
      downloadPayslipPDF(pay);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const handlePrintPayslip = () => {
    const content = payslipRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Payslip</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
      </head><body class="p-8">${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  const filteredPayroll = payrollData
    .filter((p) => p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((p) => {
      if (statusFilter === "All") return true;
      if (statusFilter === "Draft") return p.status === "Draft";
      if (statusFilter === "Approved") return p.status === "Approved";
      if (statusFilter === "Adjusted") return (p.manual_adjustment ?? 0) !== 0;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = (a.full_name || "").localeCompare(b.full_name || "");
      else if (sortBy === "net") cmp = (a.net_salary ?? 0) - (b.net_salary ?? 0);
      else if (sortBy === "status") cmp = (a.status || "").localeCompare(b.status || "");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalNet = payrollData.reduce((acc, curr) => acc + (curr.net_salary ?? 0), 0);
  const totalEPF = payrollData.reduce((acc, curr) => acc + (curr.epf_deduction ?? 0), 0);
  const totalETF = payrollData.reduce((acc, curr) => acc + (curr.etf_contribution ?? 0), 0);
  const totalFood = payrollData.reduce((acc, curr) => acc + (curr.food_deduction ?? 0), 0);
  const totalAdvance = payrollData.reduce((acc, curr) => acc + (curr.advance_recovery ?? 0), 0);
  const approvedCount = payrollData.filter((p) => p.status === "Approved").length;
  const adjustedCount = payrollData.filter((p) => (p.manual_adjustment ?? 0) !== 0).length;
  const isAllApproved = payrollData.length > 0 && payrollData.every((p) => p.status === "Approved");

  const toggleSort = (col: "name" | "net" | "status") => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewingPayslip(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-navy tracking-tight">Payroll Management</h2>
          <p className="text-slate-500 font-medium">Review, adjust, and approve monthly salary payments</p>
        </div>
        <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy">
            <ChevronLeft size={20} />
          </button>
          <div className="px-6 flex items-center gap-2 font-black text-brand-navy min-w-[180px] justify-center text-xs uppercase tracking-widest">
            <CalendarIcon size={16} />
            {format(currentDate, "MMMM yyyy")}
          </div>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-brand-navy">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Net Payable" value={`LKR ${totalNet.toLocaleString()}`} icon={CreditCard} colorClass="bg-emerald-500" />
        <StatCard label="Total EPF" value={`LKR ${totalEPF.toLocaleString()}`} icon={ShieldCheck} colorClass="bg-blue-500" />
        <StatCard label="Total ETF" value={`LKR ${totalETF.toLocaleString()}`} icon={ShieldCheck} colorClass="bg-purple-500" />
        <StatCard label="Food Deductions" value={`LKR ${totalFood.toLocaleString()}`} icon={DollarSign} colorClass="bg-amber-500" />
        <StatCard label="Advances Recovered" value={`LKR ${totalAdvance.toLocaleString()}`} icon={DollarSign} colorClass="bg-orange-500" />
        <StatCard label="Approved" value={`${approvedCount} / ${payrollData.length}`} icon={CheckCircle2} colorClass="bg-emerald-500" />
      </div>

      {/* Progress bar */}
      {payrollData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-black text-slate-500 uppercase">Payroll Approval Progress — {format(currentDate, "MMMM yyyy")}</span>
            <span className="text-sm font-black text-brand-navy">{approvedCount} / {payrollData.length} Approved</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${(approvedCount / payrollData.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by guard name..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["All", "Draft", "Approved", "Adjusted"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === s ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (payrollData.length > 0 ? setRecalcConfirm(true) : handleGeneratePayroll())}
            disabled={loading}
            className="bg-white border border-slate-200 hover:border-brand-navy/20 text-brand-navy px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            <Zap size={16} className="text-amber-500 fill-amber-500" />
            {payrollData.length > 0 ? "Recalculate" : "Generate"}
          </button>
          {payrollData.length > 0 && (
            <button
              onClick={handleBulkDownload}
              className="bg-white border border-slate-200 hover:border-brand-navy/20 text-brand-navy px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-sm"
            >
              <Download size={16} />
              Bulk Download
            </button>
          )}
          {!isAllApproved && payrollData.length > 0 && (
            <button onClick={handleApproveAll} className="bg-brand-navy hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg">
              <CheckCircle2 size={16} />
              Approve All
            </button>
          )}
        </div>
      </div>

      {/* Recalculate confirmation */}
      <AnimatePresence>
        {recalcConfirm && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <p className="text-slate-700 font-bold mb-6">
                This will recalculate all salaries from attendance data. Manual adjustments will be preserved. Continue?
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setRecalcConfirm(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={() => handleRecalculate()} className="px-6 py-2.5 rounded-xl font-bold bg-brand-navy text-white hover:bg-slate-800">Recalculate</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[calc(100vh-420px)] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr className="text-brand-navy text-[10px] uppercase tracking-widest font-black">
                <th className="px-6 py-4">Guard Details</th>
                <th className="px-4 py-4 text-center">Effective Days</th>
                <th className="px-4 py-4 text-right">Basic Salary</th>
                <th className="px-4 py-4 text-right">Deductions</th>
                <th className="px-4 py-4 text-right">Adjustment</th>
                <th className="px-4 py-4 text-right cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("net")}>
                  Net Salary {sortBy === "net" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100" onClick={() => toggleSort("status")}>
                  Status {sortBy === "status" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayroll.map((pay, idx) => {
                const totalDed = (pay.absent_deduction ?? 0) + (pay.epf_deduction ?? 0) + (pay.uniform_deduction ?? 0) + (pay.advance_recovery ?? 0) + (pay.food_deduction ?? 0);
                const hasAdjustment = (pay.manual_adjustment ?? 0) !== 0;
                const rowCls = idx % 2 === 1 ? "bg-[#F8F9FA]" : "";
                return (
                  <tr key={pay.id} className={`hover:bg-slate-50/80 transition-colors ${rowCls}`}>
                    <td className="px-6 py-4">
                      <Link to={`/guards/${pay.guard_id}`} className="block">
                        <p className="text-sm font-black text-brand-navy">{pay.full_name}</p>
                        {(pay.day_shifts > 0 || pay.night_shifts > 0) ? (
                          <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                            <span>DAY: {(pay.day_shifts ?? 0).toFixed(1)} × LKR {(pay.day_shift_rate ?? pay.basic_daily_rate ?? 0).toLocaleString()} = {(pay.day_salary ?? 0).toLocaleString()}</span>
                            <br />
                            <span>NIGHT: {(pay.night_shifts ?? 0).toFixed(1)} × LKR {(pay.night_shift_rate ?? pay.basic_daily_rate ?? 0).toLocaleString()} = {(pay.night_salary ?? 0).toLocaleString()}</span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-0.5">Rate: LKR {(pay.basic_daily_rate ?? 0).toLocaleString()}</p>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-black text-brand-navy">{pay.effective_days}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-bold text-slate-600">{(pay.basic_salary ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end text-[10px]">
                        <span className="text-sm font-black text-red-500">-{(totalDed ?? 0).toLocaleString()}</span>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-500 mt-1">
                          <span>EPF: {(pay.epf_deduction ?? 0).toLocaleString()}</span>
                          <span>Adv: {(pay.advance_recovery ?? 0).toLocaleString()}</span>
                          <span>Uni: {(pay.uniform_deduction ?? 0).toLocaleString()}</span>
                          {(pay.food_deduction ?? 0) > 0 && <span className="text-amber-600">Food: {(pay.food_deduction ?? 0).toLocaleString()}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end">
                        {hasAdjustment && <StickyNote size={14} className="text-amber-500 mb-0.5" title={pay.adjustment_reason} />}
                        <span className={`text-sm font-black ${(pay.manual_adjustment ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {(pay.manual_adjustment ?? 0) > 0 ? "+" : ""}{(pay.manual_adjustment ?? 0).toLocaleString()}
                        </span>
                        {pay.adjustment_reason && <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{pay.adjustment_reason}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-lg font-black text-brand-navy">{(pay.net_salary ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${pay.status === "Approved" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setViewingPayslip(pay)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-navy" title="View Payslip">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => downloadPayslipPDF(pay)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-navy" title="Download PDF">
                          <Download size={16} />
                        </button>
                        {pay.status === "Draft" && (
                          <button onClick={() => setEditingRecord(pay)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-brand-navy" title="Adjust">
                            <Edit3 size={16} />
                          </button>
                        )}
                        {pay.status === "Approved" && (
                          <button onClick={() => setUnapproveRecord(pay)} className="p-2 hover:bg-amber-50 rounded-lg text-amber-600" title="Unapprove">
                            <RotateCcw size={16} />
                          </button>
                        )}
                        {pay.status === "Draft" && (
                          <button onClick={() => handleApprove(pay.id)} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600" title="Approve">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPayroll.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-10 py-24 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-6">
                      <div className="bg-slate-50 p-8 rounded-full">
                        <DollarSign size={64} className="text-slate-200" />
                      </div>
                      <p className="text-xl font-black text-brand-navy">No payroll records found</p>
                      <p className="text-slate-500">Generate payroll for {format(currentDate, "MMMM yyyy")} to get started.</p>
                      <button onClick={handleGeneratePayroll} className="bg-brand-navy text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                        Generate Now
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-brand-navy">Manual Adjustment</h3>
                <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-brand-navy"><X size={24} /></button>
              </div>
              <form onSubmit={handleUpdateAdjustment} className="p-6 space-y-6">
                <p className="text-sm font-bold text-slate-600">{editingRecord.full_name}</p>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Adjustment Amount (LKR)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 mt-1 font-bold"
                    value={editingRecord.manual_adjustment}
                    onChange={(e) => setEditingRecord({ ...editingRecord, manual_adjustment: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Use negative for deductions</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Reason</label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mt-1 min-h-[80px]"
                    value={editingRecord.adjustment_reason || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, adjustment_reason: e.target.value })}
                  />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl flex justify-between">
                  <span className="text-xs font-bold text-slate-500">New Net</span>
                  <span className="text-xl font-black text-brand-navy">
                    LKR {((editingRecord.basic_salary ?? 0) - (editingRecord.absent_deduction ?? 0) - (editingRecord.epf_deduction ?? 0) - (editingRecord.uniform_deduction ?? 0) - (editingRecord.advance_recovery ?? 0) - (editingRecord.food_deduction ?? 0) + (editingRecord.manual_adjustment ?? 0)).toLocaleString()}
                  </span>
                </div>
                <button type="submit" className="w-full bg-brand-navy text-white py-4 rounded-xl font-black uppercase">
                  Save Adjustment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unapprove Modal */}
      <AnimatePresence>
        {unapproveRecord && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-black text-brand-navy mb-4">Unapprove {unapproveRecord.full_name}?</h3>
              <p className="text-slate-600 text-sm mb-4">This will set the record back to Draft for corrections.</p>
              <input
                type="text"
                placeholder="Reason (optional)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mb-6"
                value={unapproveReason}
                onChange={(e) => setUnapproveReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setUnapproveRecord(null); setUnapproveReason(""); }} className="px-6 py-2.5 rounded-xl font-bold text-slate-600">Cancel</button>
                <button onClick={handleUnapprove} className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 text-white">Unapprove</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payslip Modal — fixed size, close, PDF, content fixes */}
      <AnimatePresence>
        {viewingPayslip && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
            onClick={() => setViewingPayslip(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-[700px] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                <span className="font-bold uppercase text-xs text-slate-600">Payslip</span>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrintPayslip} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                    <Printer size={16} />
                    Print
                  </button>
                  <button onClick={() => downloadPayslipPDF(viewingPayslip)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
                    <Download size={16} />
                    Download PDF
                  </button>
                  <button onClick={() => setViewingPayslip(null)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-600">
                    <X size={22} />
                  </button>
                </div>
              </div>

              <div ref={payslipRef} className="p-8 overflow-y-auto flex-1 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-brand-navy pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex-shrink-0">
                      {viewingPayslip.profile_photo ? (
                        <img src={viewingPayslip.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-black text-brand-navy">
                          {viewingPayslip.full_name?.charAt(0) || "?"}
                        </div>
                      )}
                    </div>
                    <div>
                      <h1 className="text-2xl font-black text-brand-navy">TRANSGUARD</h1>
                      <p className="text-xs font-bold text-slate-400 uppercase">Salary Payslip — {format(currentDate, "MMMM yyyy")}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${viewingPayslip.status === "Approved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    {viewingPayslip.status}
                  </span>
                </div>

                {/* Guard Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Employee Name</p>
                      <p className="text-lg font-black text-brand-navy">{viewingPayslip.full_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Designation</p>
                      <p className="text-sm font-bold text-slate-700">{viewingPayslip.rank || viewingPayslip.designation || "Guard"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">NIC Number</p>
                      <p className="text-sm font-bold text-slate-700">{viewingPayslip.nic || "—"}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-right">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Employee ID</p>
                      <p className="text-sm font-bold">TGS-{String(viewingPayslip.guard_id).padStart(4, "0")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Assigned Site</p>
                      <p className="text-sm font-bold">{viewingPayslip.client_name || "Unassigned"}</p>
                    </div>
                  </div>
                </div>

                {/* Attendance — no LEAVE */}
                <div className="bg-slate-50 p-5 rounded-xl flex justify-around">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Present</p>
                    <p className="text-xl font-black text-brand-navy">{viewingPayslip.present_days}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Half Days</p>
                    <p className="text-xl font-black text-brand-navy">{viewingPayslip.half_days}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Absent</p>
                    <p className="text-xl font-black text-brand-navy">{viewingPayslip.absent_days ?? 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-brand-navy uppercase mb-0.5">Eff. Days</p>
                    <p className="text-2xl font-black text-brand-navy">{viewingPayslip.effective_days}</p>
                  </div>
                </div>

                {/* Earnings & Deductions */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xs font-black uppercase border-b-2 border-slate-100 pb-2 text-brand-navy mb-3">Earnings</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-slate-500">Basic Salary</span>
                        <span>{(viewingPayslip.basic_salary ?? 0).toLocaleString()}</span>
                      </div>
                      {(viewingPayslip.allowances ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-500">Allowances</span>
                          <span>{(viewingPayslip.allowances ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(viewingPayslip.manual_adjustment ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-black text-emerald-600">
                          <span>Adjustment</span>
                          <span>+{(viewingPayslip.manual_adjustment ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase border-b-2 border-slate-100 pb-2 text-brand-navy mb-3">Deductions</h3>
                    <div className="space-y-2">
                      {(viewingPayslip.absent_deduction ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-500">Absent Deduction</span>
                          <span className="text-red-500">-{(viewingPayslip.absent_deduction ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(viewingPayslip.epf_deduction ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-500">EPF</span>
                          <span className="text-red-500">-{(viewingPayslip.epf_deduction ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(viewingPayslip.uniform_deduction ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-500">Uniform Deduction</span>
                          <span className="text-red-500">-{(viewingPayslip.uniform_deduction ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(viewingPayslip.food_deduction ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-500">Food Deduction</span>
                          <span className="text-red-500">-{(viewingPayslip.food_deduction ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(viewingPayslip.advance_recovery ?? 0) > 0 && (
                        <div className="flex justify-between text-sm font-bold">
                          <span className="text-slate-500">Advance Recovery</span>
                          <span className="text-red-500">-{(viewingPayslip.advance_recovery ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(viewingPayslip.manual_adjustment ?? 0) < 0 && (
                        <div className="flex justify-between text-sm font-black text-red-600">
                          <span>Adjustment</span>
                          <span>{(viewingPayslip.manual_adjustment ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Net */}
                <div className="bg-brand-navy text-white p-6 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-white/60 uppercase mb-1">Net Payable</p>
                    <h2 className="text-3xl font-black">LKR {(viewingPayslip.net_salary ?? 0).toLocaleString()}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-white/60 uppercase mb-1">Employer ETF</p>
                    <p className="text-lg font-black">LKR {(viewingPayslip.etf_contribution ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-slate-400">
                  <span>Generated {format(new Date(), "PPpp")}</span>
                  <span>Authorized Signature</span>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
                <button onClick={() => setViewingPayslip(null)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100">
                  Close
                </button>
                <button onClick={handlePrintPayslip} className="px-6 py-2.5 rounded-xl font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 flex items-center gap-2">
                  <Printer size={16} />
                  Print
                </button>
                <button onClick={() => downloadPayslipPDF(viewingPayslip)} className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2">
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
