import React, { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  Users,
  Calendar,
  MoreVertical,
  Edit2,
  LayoutGrid,
  List,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  CalendarCheck,
  UserX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, differenceInDays } from "date-fns";

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [guardDetails, setGuardDetails] = useState<Record<number, any[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expiring" | "no-guards">("all");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [newClient, setNewClient] = useState<any>({
    name: "",
    brn: "",
    address: "",
    contact_person: "",
    phone: "",
    email: "",
    contract_start: "",
    contract_end: "",
    guards_required: 0,
    status: "Active",
    notes: "",
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = () => {
    fetch("/api/clients?withCount=true")
      .then((res) => res.json())
      .then((data) => {
        setClients(data);
        data.forEach((c: any) => fetchGuardsForClient(c.id));
      });
  };

  const fetchGuardsForClient = (clientId: number) => {
    fetch(`/api/clients/${clientId}/guards`)
      .then((res) => res.json())
      .then((guards) => setGuardDetails((prev) => ({ ...prev, [clientId]: guards })));
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = !!newClient.id;
    const url = isEdit ? `/api/clients/${newClient.id}` : "/api/clients";
    const method = isEdit ? "PUT" : "POST";

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    }).then(async (res) => {
      const data = await res.json();
      setIsModalOpen(false);
      fetchClients();
      if (!isEdit && data.id) {
        window.location.href = `/clients/${data.id}`;
      }
    });
  };

  const handleAddNewClick = () => {
    setNewClient({
      name: "", brn: "", address: "", contact_person: "", phone: "", email: "",
      contract_start: "", contract_end: "", guards_required: 0, status: "Active",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const getInitials = (name: string) => (name || "??").split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();

  const filteredClients = clients
    .filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((c) => {
      if (filter === "active") return c.status === "Active";
      if (filter === "expiring") {
        if (!c.contract_end) return false;
        const days = differenceInDays(new Date(c.contract_end), new Date());
        return days <= 30 && days >= 0 && c.status === "Active";
      }
      if (filter === "no-guards") return (c.assigned_count || c.guard_count || 0) === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "contract_end") return (a.contract_end || "").localeCompare(b.contract_end || "");
      return 0;
    });

  const menuItems = (client: any) => [
    { label: "Edit Client Details", to: `/clients/${client.id}`, icon: Edit2 },
    { label: "View Attendance", to: `/clients/${client.id}?tab=attendance`, icon: CalendarCheck },
    { label: "Generate Invoice", to: `/clients/${client.id}?tab=invoice`, icon: FileText },
    { label: client.status === "Active" ? "Deactivate Client" : "Activate Client", action: "toggleStatus", icon: UserX },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-brand-navy tracking-tight">Client Management</h2>
          <p className="text-slate-500 font-medium">Manage your client sites and service contracts</p>
        </div>
        <button
          onClick={handleAddNewClick}
          className="bg-brand-navy hover:bg-slate-800 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-brand-navy/20 flex items-center gap-3"
        >
          <Plus size={20} />
          <span>Add New Client</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search clients by name..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-5 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10 shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "expiring", "no-guards"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                filter === f ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "All Clients" : f === "active" ? "Active" : f === "expiring" ? "Expiring Soon" : "No Guards"}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-xs"
          >
            <option value="name">Name A–Z</option>
            <option value="contract_end">Contract End</option>
          </select>
          <div className="flex border border-slate-200 rounded-xl overflow-hidden">
            <button onClick={() => setViewMode("cards")} className={`p-2.5 ${viewMode === "cards" ? "bg-brand-navy text-white" : "bg-slate-50"}`}><LayoutGrid size={18} /></button>
            <button onClick={() => setViewMode("list")} className={`p-2.5 ${viewMode === "list" ? "bg-brand-navy text-white" : "bg-slate-50"}`}><List size={18} /></button>
          </div>
        </div>
      </div>

      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredClients.map((client) => {
            const guards = guardDetails[client.id] || [];
            const assigned = client.assigned_count ?? client.guard_count ?? guards.length;
            const required = client.guards_required || 0;
            const isFullyStaffed = required === 0 || assigned >= required;
            const contractEnd = client.contract_end ? new Date(client.contract_end) : null;
            const daysToExpiry = contractEnd ? differenceInDays(contractEnd, new Date()) : null;
            const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0;
            const statusBadge = client.status === "Inactive" ? "INACTIVE" : isExpiringSoon ? "EXPIRING" : "ACTIVE";
            const gapsToday = (client.present_today ?? 0) < required ? Math.max(0, required - (client.present_today ?? 0)) : 0;

            return (
              <div key={client.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:border-brand-navy/20 hover:shadow-xl transition-all group relative overflow-hidden">
                {isExpiringSoon && (
                  <div className="absolute top-4 left-4 right-4 flex justify-center">
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full flex items-center gap-1">
                      <AlertTriangle size={12} /> Contract expires in {daysToExpiry} days
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-slate-50 p-4 rounded-2xl text-brand-navy shadow-inner overflow-hidden">
                    {client.logo ? (
                      <img src={client.logo} alt="" className="w-12 h-12 object-cover rounded-xl" />
                    ) : (
                      <span className="text-lg font-black">{getInitials(client.name)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                      statusBadge === "ACTIVE" ? "bg-emerald-50 text-emerald-600" :
                      statusBadge === "EXPIRING" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                    }`}>
                      {statusBadge}
                    </span>
                    <div className="relative">
                      <button onClick={() => setMenuOpen(menuOpen === client.id ? null : client.id)} className="text-slate-300 hover:text-brand-navy transition-colors p-2 hover:bg-slate-50 rounded-xl">
                        <MoreVertical size={20} />
                      </button>
                      {menuOpen === client.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 top-full mt-1 py-2 bg-white border rounded-xl shadow-xl z-20 min-w-[180px]">
                            {menuItems(client).map((item) =>
                              item.to ? (
                                <Link key={item.label} to={item.to} onClick={() => setMenuOpen(null)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                  <item.icon size={16} /> {item.label}
                                </Link>
                              ) : (
                                <button key={item.label} onClick={() => { setMenuOpen(null); /* toggle status */ }} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 w-full text-left">
                                  <item.icon size={16} /> {item.label}
                                </button>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Link to={`/clients/${client.id}`}>
                  <h3 className="text-2xl font-black text-brand-navy mb-1 tracking-tight hover:text-brand-navy/80">{client.name}</h3>
                </Link>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">BRN: {client.brn || "—"}</p>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
                    <MapPin size={18} className="text-slate-300 shrink-0" />
                    <span className="truncate">{client.address || "No address"}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold">
                    <Users size={18} className="text-slate-300 shrink-0" />
                    <span className={isFullyStaffed ? "text-emerald-600" : "text-amber-600"}>
                      {assigned} Assigned / {required || "—"} Required {isFullyStaffed && required > 0 ? "✓" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
                    <Calendar size={18} className="text-slate-300 shrink-0" />
                    <span>Ends: {client.contract_end ? format(new Date(client.contract_end), "dd MMM yyyy") : "—"}</span>
                  </div>
                  <Link to={`/scheduling/calendar?client=${client.id}`} className="flex items-center gap-2 text-xs font-bold">
                    Today: {gapsToday > 0 ? (
                      <span className="text-amber-600">⚠️ {gapsToday} Gaps Today</span>
                    ) : (
                      <span className="text-emerald-600">✓ Fully Covered</span>
                    )}
                  </Link>
                </div>

                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex -space-x-3" title={guards.map((g: any) => g.full_name).join(", ")}>
                    {guards.slice(0, 3).map((g: any, i: number) => (
                      <Link key={g.id} to={`/clients/${client.id}?tab=guards`} className="w-10 h-10 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-brand-navy shadow-sm hover:ring-2 hover:ring-brand-navy/30 transition-all" title={g.full_name}>
                        {(g.full_name || "G").slice(0, 1)}
                      </Link>
                    ))}
                    {guards.length > 3 && (
                      <Link to={`/clients/${client.id}?tab=guards`} className="w-10 h-10 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-400 shadow-sm hover:bg-slate-100 transition-all" title={`${guards.length} guards - click to view`}>
                        +{guards.length - 3}
                      </Link>
                    )}
                    {guards.length === 0 && (
                      <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-400">0</div>
                    )}
                  </div>
                  <Link to={`/clients/${client.id}`} className="text-brand-navy text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:text-slate-900 transition-colors">
                    Edit / Details
                    <Edit2 size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "list" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Guards</th>
                <th className="px-6 py-4">Contract End</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const assigned = client.assigned_count ?? client.guard_count ?? 0;
                const required = client.guards_required || 0;
                const contractEnd = client.contract_end ? new Date(client.contract_end) : null;
                const daysToExpiry = contractEnd ? differenceInDays(contractEnd, new Date()) : null;
                const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0;
                return (
                  <tr key={client.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <Link to={`/clients/${client.id}`} className="font-bold text-brand-navy hover:underline">{client.name}</Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]">{client.address || "—"}</td>
                    <td className="px-6 py-4 text-sm font-bold">{assigned} / {required || "—"}</td>
                    <td className="px-6 py-4 text-sm">{client.contract_end ? format(new Date(client.contract_end), "dd MMM yyyy") : "—"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                        client.status === "Inactive" ? "bg-red-50 text-red-600" : isExpiringSoon ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {client.status === "Inactive" ? "Inactive" : isExpiringSoon ? "Expiring" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/clients/${client.id}`} className="text-xs font-bold text-brand-navy">View →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredClients.length === 0 && (
            <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-500">No clients match your filters.</td></tr>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-brand-navy/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-2xl font-black text-brand-navy tracking-tight">{newClient.id ? "Edit Client Site" : "Add New Client Site"}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-brand-navy transition-colors">
                <X size={28} />
              </button>
            </div>
            <form onSubmit={handleSaveClient} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Name *</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Registration No</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.brn} onChange={(e) => setNewClient({ ...newClient, brn: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Site Address *</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person Name *</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.contact_person} onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Phone *</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Email</label>
                  <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contract Start Date *</label>
                  <input required type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.contract_start} onChange={(e) => setNewClient({ ...newClient, contract_start: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contract End Date</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.contract_end} onChange={(e) => setNewClient({ ...newClient, contract_end: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guards Required</label>
                  <input type="number" min={0} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1" value={newClient.guards_required} onChange={(e) => setNewClient({ ...newClient, guards_required: Number(e.target.value) || 0 })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes / Instructions</label>
                  <textarea rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-brand-navy font-bold mt-1 resize-none" value={newClient.notes} onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-50 rounded-xl">Cancel</button>
                <button type="submit" className="bg-brand-navy text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
