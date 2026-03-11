import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, UserPlus, Edit2, Trash2, ChevronRight,
  ShieldAlert, Building2, X, Eye, LayoutGrid, LayoutList,
  AlertTriangle, Download
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 25;
const STATUS_PILLS = ["All", "Active", "Inactive", "Temporary", "Ad-Hoc"];

function getGuardId(guard: any) {
  if (guard.guard_type === "Temporary") return guard.nic ? `TGST-${String(guard.id).padStart(4, "0")}` : "TEM";
  if (guard.guard_type === "Office") return `TGO-${String(guard.id).padStart(4, "0")}`;
  if (guard.guard_type === "Volunteer" || guard.guard_type === "Ad-Hoc") return `TGV-${String(guard.id).padStart(4, "0")}`;
  return `TGS-${String(guard.id).padStart(4, "0")}`;
}

function isProfileIncomplete(guard: any): string[] {
  const missing: string[] = [];
  if (!guard.nic?.trim()) missing.push("NIC");
  if (!guard.phone?.trim()) missing.push("Phone");
  if (!guard.profile_photo) missing.push("Profile Photo");
  return missing;
}

function formatLastAttendance(last: { date: string; status: string } | undefined, today: string) {
  if (!last) return { text: "Never marked", icon: "⚠️", cls: "text-amber-600" };
  const d = last.date;
  if (d === today) return { text: "Today · " + (last.status === "P" ? "Present" : last.status === "A" ? "Absent" : last.status === "H" ? "Half-Day" : last.status), icon: last.status === "P" ? "✅" : last.status === "A" ? "🔴" : "🟡", cls: last.status === "P" ? "text-emerald-600" : last.status === "A" ? "text-red-600" : "text-amber-600" };
  const diff = Math.floor((new Date(today).getTime() - new Date(d).getTime()) / 86400000);
  if (diff === 1) return { text: "Yesterday · " + last.status, icon: "🔴", cls: "text-slate-500" };
  return { text: `${diff} days ago · ${last.status === "P" ? "Present" : last.status === "A" ? "Absent" : last.status}`, icon: diff > 7 ? "⚠️" : "🔴", cls: "text-slate-500" };
}

const InputF = ({ label, value, onChange, type = "text", options = null }: any) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    {options ? (
      <select
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input
        type={type}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    )}
  </div>
);

export default function Guards() {
  const navigate = useNavigate();
  const [guards, setGuards] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [lastAttendance, setLastAttendance] = useState<Record<number, { date: string; status: string }>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [clientFilter, setClientFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [sortBy, setSortBy] = useState<"name" | "joined" | "client" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<any>(null);
  const [viewingGuard, setViewingGuard] = useState<any>(null);
  const [deactivatingGuard, setDeactivatingGuard] = useState<any>(null);
  const [newGuard, setNewGuard] = useState({
    full_name: "", dob: "", gender: "Male", nic: "", passport: "", phone: "",
    emergency_contact_name: "", emergency_contact_phone: "", permanent_address: "", current_address: "",
    blood_group: "O+", joined_date: new Date().toISOString().split("T")[0], designation: "Security Guard",
    rank: "Guard", guard_type: "Regular", client_id: "", basic_daily_rate: 1500, day_shift_rate: 1500,
    night_shift_rate: 1500, epf_enrolled: true, epf_rate: 8, etf_rate: 3,
    uniform_deduction_amount: 0, uniform_installments: 1, status: "Active",
  });

  useEffect(() => {
    fetchGuards();
    fetchClients();
    fetchLastAttendance();
  }, []);

  const fetchGuards = () => {
    fetch("/api/guards")
      .then((r) => r.json())
      .then((d) => setGuards(Array.isArray(d) ? d : []));
  };

  const fetchClients = () => {
    fetch("/api/clients?withCount=true")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : []));
  };

  const fetchLastAttendance = () => {
    fetch("/api/guards/last-attendance")
      .then((r) => r.json())
      .then((d) => setLastAttendance(d || {}));
  };

  const handleDeactivate = (guard: any) => {
    setDeactivatingGuard(guard);
  };

  const confirmDeactivate = async () => {
    if (!deactivatingGuard) return;
    try {
      await fetch(`/api/guards/${deactivatingGuard.id}`, { method: "DELETE" });
      setDeactivatingGuard(null);
      fetchGuards();
    } catch {
      alert("Failed to deactivate.");
    }
  };

  const handleEdit = (e: React.MouseEvent, guard: any) => {
    e.stopPropagation();
    setEditingGuard({ ...guard });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuard) return;
    const payload = { ...editingGuard };
    delete payload.client_name;
    if (payload.epf_enrolled !== undefined) payload.epf_enrolled = payload.epf_enrolled ? 1 : 0;
    try {
      await fetch(`/api/guards/${editingGuard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setEditingGuard(null);
      fetchGuards();
    } catch {
      alert("Failed to save.");
    }
  };

  const handleAddGuard = (e: React.FormEvent) => {
    e.preventDefault();
    fetch("/api/guards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGuard),
    }).then(() => {
      setIsModalOpen(false);
      setNewGuard({
        full_name: "", dob: "", gender: "Male", nic: "", passport: "", phone: "",
        emergency_contact_name: "", emergency_contact_phone: "", permanent_address: "", current_address: "",
        blood_group: "O+", joined_date: new Date().toISOString().split("T")[0], designation: "Security Guard",
        rank: "Guard", guard_type: "Regular", client_id: "", basic_daily_rate: 1500, day_shift_rate: 1500,
        night_shift_rate: 1500, epf_enrolled: true, epf_rate: 8, etf_rate: 3,
        uniform_deduction_amount: 0, uniform_installments: 1, status: "Active",
      });
      fetchGuards();
    });
  };

  const toggleSort = (col: "name" | "joined" | "client" | "status") => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const filteredGuards = useMemo(() => {
    let list = guards.filter((g) => {
      const matchesSearch =
        g.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.nic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getGuardId(g).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Ad-Hoc" && (g.guard_type === "Volunteer" || g.guard_type === "Ad-Hoc")) ||
        (statusFilter === "Temporary" && g.guard_type === "Temporary") ||
        (statusFilter === "Inactive" && ["Inactive", "Resigned", "Terminated"].includes(g.status)) ||
        g.status === statusFilter;
      const matchesClient =
        clientFilter === "All" ||
        (clientFilter === "" && !g.client_id) ||
        String(g.client_id) === clientFilter;
      return matchesSearch && matchesStatus && matchesClient;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = (a.full_name || "").localeCompare(b.full_name || "");
      else if (sortBy === "joined") cmp = (a.joined_date || "").localeCompare(b.joined_date || "");
      else if (sortBy === "client") cmp = (a.client_name || "Unassigned").localeCompare(b.client_name || "Unassigned");
      else if (sortBy === "status") cmp = (a.status || "").localeCompare(b.status || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [guards, searchTerm, statusFilter, clientFilter, sortBy, sortDir]);

  const paginatedGuards = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredGuards.slice(start, start + PAGE_SIZE);
  }, [filteredGuards, page]);

  const totalPages = Math.ceil(filteredGuards.length / PAGE_SIZE) || 1;

  const stats = useMemo(() => {
    const active = guards.filter((g) => g.status === "Active").length;
    const inactive = guards.filter((g) => ["Inactive", "Resigned", "Terminated"].includes(g.status)).length;
    const temp = guards.filter((g) => g.guard_type === "Temporary").length;
    const adhoc = guards.filter((g) => g.guard_type === "Volunteer" || g.guard_type === "Ad-Hoc").length;
    const unassigned = guards.filter((g) => !g.client_id).length;
    return { total: guards.length, active, inactive, temp, adhoc, unassigned };
  }, [guards]);

  const handleExport = () => {
    const headers = ["Name", "ID", "NIC", "Phone", "Client", "Status", "Join Date"];
    const rows = filteredGuards.map((g) => [
      g.full_name,
      getGuardId(g),
      g.nic || "",
      g.phone || "",
      g.client_name || "Unassigned",
      g.status,
      g.joined_date,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `guards-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleSelect = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginatedGuards.length) setSelected(new Set());
    else setSelected(new Set(paginatedGuards.map((g) => g.id)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !document.activeElement?.matches("input, select, textarea")) {
        setIsModalOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-brand-navy tracking-tight">Guard Management</h2>
          <p className="text-slate-500 font-medium">Manage your security personnel records</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Download size={18} />
            <span>Export</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-navy hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-navy/20"
          >
            <Plus size={20} />
            <span>Add New Guard</span>
            <span className="text-[10px] font-normal opacity-70">[N]</span>
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: `${stats.total} Total`, onClick: () => setStatusFilter("All") },
          { label: `${stats.active} Active`, onClick: () => setStatusFilter("Active") },
          { label: `${stats.inactive} Inactive`, onClick: () => setStatusFilter("Inactive") },
          { label: `${stats.temp} Temporary`, onClick: () => setStatusFilter("Temporary") },
          { label: `${stats.adhoc} Ad-Hoc`, onClick: () => setStatusFilter("Ad-Hoc") },
          { label: `${stats.unassigned} Unassigned`, onClick: () => setClientFilter("") },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-brand-navy hover:text-white transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or NIC..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1.5">
            {STATUS_PILLS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === s ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <select
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-navy/10 shadow-sm font-semibold text-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="All">All Clients</option>
            <option value="">Unassigned ({stats.unassigned})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.guard_count ?? 0})
              </option>
            ))}
          </select>
          <div className="flex gap-1 border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2.5 ${viewMode === "table" ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600"}`}
              title="Table view"
            >
              <LayoutList size={18} />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`p-2.5 ${viewMode === "card" ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600"}`}
              title="Card view"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        {viewMode === "table" ? (
          <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                <tr className="text-brand-navy text-[10px] uppercase font-black tracking-widest">
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedGuards.length > 0 && selected.size === paginatedGuards.length}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("name")}
                  >
                    Guard Details {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-6 py-4">NIC / Phone</th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("client")}
                  >
                    Assigned Client {sortBy === "client" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("status")}
                  >
                    Status {sortBy === "status" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("joined")}
                  >
                    Join Date {sortBy === "joined" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-10 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedGuards.map((guard, idx) => {
                  const last = lastAttendance[guard.id];
                  const lastInfo = formatLastAttendance(last, today);
                  const missing = isProfileIncomplete(guard);
                  const rowCls = idx % 2 === 1 ? "bg-[#F8F9FA]" : "";
                  return (
                    <tr
                      key={guard.id}
                      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${rowCls}`}
                      onClick={() => navigate(`/guards/${guard.id}`)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(guard.id)}
                          onChange={() => toggleSelect(guard.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-brand-navy font-black border border-slate-200 overflow-hidden flex-shrink-0">
                            {guard.profile_photo ? (
                              <img src={guard.profile_photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              guard.full_name?.charAt(0) || "?"
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-black text-brand-navy">{guard.full_name}</p>
                              {missing.length > 0 && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
                                  title={`Missing: ${missing.join(", ")}`}
                                />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{lastInfo.text} {lastInfo.icon}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-slate-400 font-black uppercase">{guard.guard_type}</span>
                              <span className="text-[9px] text-slate-300">•</span>
                              <span className="text-[9px] text-slate-500 font-black uppercase">{guard.rank || "Guard"}</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                              {getGuardId(guard)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-600">{guard.nic || "—"}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{guard.phone || "—"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                          <Building2 size={14} className="text-slate-400" />
                          {guard.client_name || "Unassigned"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                            guard.status === "Active"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : "bg-red-50 text-red-600 border border-red-100"
                          }`}
                        >
                          {guard.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">{guard.joined_date}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => handleEdit(e, guard)}
                            className="p-2 hover:bg-white hover:shadow border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-brand-navy"
                            title="Edit guard"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingGuard(guard);
                            }}
                            className="p-2 hover:bg-white hover:shadow border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
                            title="View full profile"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeactivate(guard);
                            }}
                            className="p-2 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg text-slate-300 hover:text-red-500"
                            title="Deactivate guard"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedGuards.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-8 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-slate-50 p-6 rounded-[2rem]">
                          <ShieldAlert size={48} className="text-slate-200" />
                        </div>
                        <p className="font-bold">No guards found matching your search.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[calc(100vh-320px)] overflow-y-auto">
            {paginatedGuards.map((guard) => (
              <div
                key={guard.id}
                onClick={() => navigate(`/guards/${guard.id}`)}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:border-slate-200 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl font-black text-brand-navy overflow-hidden">
                    {guard.profile_photo ? (
                      <img src={guard.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      guard.full_name?.charAt(0) || "?"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-brand-navy truncate">{guard.full_name}</p>
                    <p className="text-xs text-slate-500 font-bold">{guard.rank || "Guard"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2">
                  <Building2 size={12} />
                  {guard.client_name || "Unassigned"}
                </div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                    guard.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  }`}
                >
                  {guard.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredGuards.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredGuards.length)} of {filteredGuards.length} guards
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
              >
                &lt;
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 rounded-xl font-bold ${
                      page === p ? "bg-brand-navy text-white" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size >= 2 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50"
          >
            <span className="font-bold">{selected.size} guards selected</span>
            <button className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-sm">
              Change Status ▾
            </button>
            <button className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-sm">
              Assign to Site ▾
            </button>
            <button className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-sm">
              Export Selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-2 rounded-xl bg-red-500/30 hover:bg-red-500/50 font-bold text-sm"
            >
              ✕ Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deactivate confirmation */}
      <AnimatePresence>
        {deactivatingGuard && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-full bg-amber-100">
                  <AlertTriangle size={24} className="text-amber-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Deactivate {deactivatingGuard.full_name}?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                This guard will be removed from active scheduling and payroll. Their history will be preserved.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeactivatingGuard(null)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeactivate}
                  className="px-6 py-2.5 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600"
                >
                  Deactivate Guard
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick view modal */}
      <AnimatePresence>
        {viewingGuard && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-brand-navy">Quick View</h3>
                <button onClick={() => setViewingGuard(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-black text-brand-navy overflow-hidden">
                    {viewingGuard.profile_photo ? (
                      <img src={viewingGuard.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      viewingGuard.full_name?.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{viewingGuard.full_name}</p>
                    <p className="text-slate-500 font-bold">{getGuardId(viewingGuard)} · {viewingGuard.rank || "Guard"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-slate-400 font-bold">NIC</span><p className="font-bold text-slate-700">{viewingGuard.nic || "—"}</p></div>
                  <div><span className="text-slate-400 font-bold">Phone</span><p className="font-bold text-slate-700">{viewingGuard.phone || "—"}</p></div>
                  <div><span className="text-slate-400 font-bold">Client</span><p className="font-bold text-slate-700">{viewingGuard.client_name || "Unassigned"}</p></div>
                  <div><span className="text-slate-400 font-bold">Status</span><p className="font-bold text-slate-700">{viewingGuard.status}</p></div>
                  <div><span className="text-slate-400 font-bold">Joined</span><p className="font-bold text-slate-700">{viewingGuard.joined_date}</p></div>
                  <div><span className="text-slate-400 font-bold">Day Rate</span><p className="font-bold text-slate-700">LKR {viewingGuard.day_shift_rate || 0}</p></div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setViewingGuard(null);
                    navigate(`/guards/${viewingGuard.id}`);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-navy text-white py-3 rounded-xl font-bold"
                >
                  Open Full Profile
                  <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit modal — full editable form */}
      <AnimatePresence>
        {editingGuard && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-brand-navy p-3 rounded-2xl">
                    <Edit2 className="text-white" size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-brand-navy">Edit Guard — {editingGuard.full_name}</h3>
                </div>
                <button onClick={() => setEditingGuard(null)} className="text-slate-400 hover:text-brand-navy">
                  <X size={28} />
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputF label="Full Name" value={editingGuard.full_name} onChange={(v) => setEditingGuard({ ...editingGuard, full_name: v })} />
                  <InputF label="NIC" value={editingGuard.nic} onChange={(v) => setEditingGuard({ ...editingGuard, nic: v })} />
                  <InputF label="Phone" value={editingGuard.phone} onChange={(v) => setEditingGuard({ ...editingGuard, phone: v })} />
                  <InputF label="Date of Birth" type="date" value={editingGuard.dob} onChange={(v) => setEditingGuard({ ...editingGuard, dob: v })} />
                  <InputF label="Gender" value={editingGuard.gender} options={["Male", "Female", "Other"]} onChange={(v) => setEditingGuard({ ...editingGuard, gender: v })} />
                  <InputF label="Blood Group" value={editingGuard.blood_group} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} onChange={(v) => setEditingGuard({ ...editingGuard, blood_group: v })} />
                  <InputF label="Permanent Address" value={editingGuard.permanent_address} onChange={(v) => setEditingGuard({ ...editingGuard, permanent_address: v })} />
                  <InputF label="Current Address" value={editingGuard.current_address} onChange={(v) => setEditingGuard({ ...editingGuard, current_address: v })} />
                  <InputF label="Emergency Contact" value={editingGuard.emergency_contact_name} onChange={(v) => setEditingGuard({ ...editingGuard, emergency_contact_name: v })} />
                  <InputF label="Emergency Phone" value={editingGuard.emergency_contact_phone} onChange={(v) => setEditingGuard({ ...editingGuard, emergency_contact_phone: v })} />
                  <InputF label="Rank" value={editingGuard.rank} options={["Guard", "SO", "SSO", "Supervisor", "Office Staff"]} onChange={(v) => setEditingGuard({ ...editingGuard, rank: v })} />
                  <InputF label="Guard Type" value={editingGuard.guard_type} options={["Regular", "Temporary", "Office", "Volunteer"]} onChange={(v) => setEditingGuard({ ...editingGuard, guard_type: v })} />
                  <InputF label="Status" value={editingGuard.status} options={["Active", "Inactive", "On Paid Leave", "Resigned", "Terminated"]} onChange={(v) => setEditingGuard({ ...editingGuard, status: v })} />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Client</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 text-sm"
                      value={editingGuard.client_id ?? ""}
                      onChange={(e) => setEditingGuard({ ...editingGuard, client_id: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <InputF label="Join Date" type="date" value={editingGuard.joined_date} onChange={(v) => setEditingGuard({ ...editingGuard, joined_date: v })} />
                  <InputF label="Day Shift Rate (LKR)" type="number" value={editingGuard.day_shift_rate} onChange={(v) => setEditingGuard({ ...editingGuard, day_shift_rate: Number(v) })} />
                  <InputF label="Night Shift Rate (LKR)" type="number" value={editingGuard.night_shift_rate} onChange={(v) => setEditingGuard({ ...editingGuard, night_shift_rate: Number(v) })} />
                  <div className="space-y-1.5 flex flex-col justify-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded text-brand-navy"
                        checked={!!editingGuard.epf_enrolled}
                        onChange={(e) => setEditingGuard({ ...editingGuard, epf_enrolled: e.target.checked })}
                      />
                      <span className="text-sm font-bold text-slate-600">EPF/ETF Enrolled</span>
                    </label>
                  </div>
                  {editingGuard.epf_enrolled && (
                    <>
                      <InputF label="EPF %" type="number" value={editingGuard.epf_rate} onChange={(v) => setEditingGuard({ ...editingGuard, epf_rate: Number(v) })} />
                      <InputF label="ETF %" type="number" value={editingGuard.etf_rate} onChange={(v) => setEditingGuard({ ...editingGuard, etf_rate: Number(v) })} />
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setEditingGuard(null)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" className="px-8 py-2.5 rounded-xl font-black bg-brand-navy text-white hover:bg-slate-800">
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Guard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-brand-navy p-3 rounded-2xl">
                  <UserPlus className="text-white" size={24} />
                </div>
                <h3 className="text-2xl font-black text-brand-navy tracking-tight">Add New Guard</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-brand-navy transition-colors">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleAddGuard} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputF label="Full Name" value={newGuard.full_name} onChange={(v) => setNewGuard({ ...newGuard, full_name: v })} />
                <InputF label="NIC (Optional for TEM)" value={newGuard.nic} onChange={(v) => setNewGuard({ ...newGuard, nic: v })} />
                <InputF label="Phone" value={newGuard.phone} onChange={(v) => setNewGuard({ ...newGuard, phone: v })} />
                <InputF label="Date of Birth" type="date" value={newGuard.dob} onChange={(v) => setNewGuard({ ...newGuard, dob: v })} />
                <InputF label="Join Date" type="date" value={newGuard.joined_date} onChange={(v) => setNewGuard({ ...newGuard, joined_date: v })} />
                <InputF label="Guard Type" value={newGuard.guard_type} options={["Regular", "Temporary", "Office", "Volunteer"]} onChange={(v) => setNewGuard({ ...newGuard, guard_type: v })} />
                <InputF label="Rank" value={newGuard.rank} options={["Guard", "SO", "SSO", "Supervisor", "Office Staff"]} onChange={(v) => setNewGuard({ ...newGuard, rank: v })} />
                <InputF label="Day Shift Rate (LKR)" type="number" value={newGuard.day_shift_rate} onChange={(v) => setNewGuard({ ...newGuard, day_shift_rate: Number(v) })} />
                <InputF label="Night Shift Rate (LKR)" type="number" value={newGuard.night_shift_rate} onChange={(v) => setNewGuard({ ...newGuard, night_shift_rate: Number(v) })} />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Client</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 text-sm"
                    value={newGuard.client_id}
                    onChange={(e) => setNewGuard({ ...newGuard, client_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-brand-navy" checked={newGuard.epf_enrolled} onChange={(e) => setNewGuard({ ...newGuard, epf_enrolled: e.target.checked })} />
                    <span className="text-sm font-bold text-slate-600">EPF/ETF Enrolled</span>
                  </label>
                </div>
                {newGuard.epf_enrolled && (
                  <>
                    <InputF label="EPF %" type="number" value={newGuard.epf_rate} onChange={(v) => setNewGuard({ ...newGuard, epf_rate: Number(v) })} />
                    <InputF label="ETF %" type="number" value={newGuard.etf_rate} onChange={(v) => setNewGuard({ ...newGuard, etf_rate: Number(v) })} />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="bg-brand-navy hover:bg-slate-800 text-white px-10 py-3 rounded-2xl font-black uppercase tracking-widest">
                  Save Guard
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
