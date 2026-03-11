import React, { useState, useEffect } from "react";
import {
  Building2,
  ArrowLeft,
  Users,
  CalendarCheck,
  FileText,
  History,
  FolderOpen,
  Plus,
  X,
  Edit2,
  CheckCircle2,
  Download,
  Trash2,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

const tabs = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "guards", label: "Guards", icon: Users },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "invoice", label: "Invoice", icon: FileText },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "history", label: "History", icon: History },
];

export default function ClientProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [client, setClient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(tabFromUrl && ["overview", "guards", "attendance", "invoice", "documents", "history"].includes(tabFromUrl) ? tabFromUrl : "overview");
  const [guards, setGuards] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [billingRates, setBillingRates] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoicePreview, setInvoicePreview] = useState<any>(null);
  const [attMonth, setAttMonth] = useState(new Date().getMonth() + 1);
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [newRate, setNewRate] = useState({ shift: "DAY", rank: "SSO", required_count: 1, day_rate: "", night_rate: "" });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tabFromUrl && ["overview", "guards", "attendance", "invoice", "documents", "history"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/clients/${id}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch client details");
        return r.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClient(data || {});
      })
      .catch((err) => {
        if (err.name === 'AbortError') setError('Request timed out. Please try again.');
        else setError(err.message);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id || error || isLoading) return;
    if (activeTab === "guards") fetch(`/api/clients/${id}/guards`).then((r) => r.json()).then(setGuards).catch(console.error);
    if (activeTab === "attendance") fetch(`/api/clients/${id}/attendance?month=${attMonth}&year=${attYear}`).then((r) => r.json()).then(setAttendance).catch(console.error);
    if (activeTab === "invoice") {
      fetch(`/api/clients/${id}/billing-rates`).then((r) => r.json()).then(setBillingRates).catch(console.error);
      fetch(`/api/clients/${id}/invoices`).then((r) => r.json()).then(setInvoices).catch(console.error);
    }
    if (activeTab === "history") fetch(`/api/clients/${id}/history`).then((r) => r.json()).then(setHistory).catch(console.error);
  }, [id, activeTab, attMonth, attYear, error, isLoading]);

  useEffect(() => {
    if (client) setForm(client);
  }, [client]);

  const handleSaveOverview = () => {
    fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(() => {
      setClient(form);
      setEditing(false);
    });
  };

  const handleAddRate = () => {
    fetch(`/api/clients/${id}/billing-rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newRate,
        day_rate: newRate.day_rate ? Number(newRate.day_rate) : null,
        night_rate: newRate.night_rate ? Number(newRate.night_rate) : null,
      }),
    }).then(() => {
      fetch(`/api/clients/${id}/billing-rates`).then((r) => r.json()).then(setBillingRates);
      setNewRate({ shift: "DAY", rank: "SSO", required_count: 1, day_rate: "", night_rate: "" });
    });
  };

  const handleGenerateInvoice = () => {
    fetch(`/api/clients/${id}/invoices/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: invoiceMonth, year: invoiceYear }),
    })
      .then((r) => r.json())
      .then((data) => {
        setInvoicePreview(data);
        fetch(`/api/clients/${id}/invoices`).then((r) => r.json()).then(setInvoices);
      });
  };

  const handleFinaliseInvoice = (invId: number) => {
    fetch(`/api/clients/${id}/invoices/${invId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Finalised" }),
    }).then(() => fetch(`/api/clients/${id}/invoices`).then((r) => r.json()).then(setInvoices));
  };

  const getInitials = (name: string) => (name || "??").split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();

  if (isLoading) {
    return (
      <div className="space-y-8 pb-20 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 rounded-xl"></div>
          <div className="flex-1 space-y-2">
            <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-32 bg-slate-100 rounded-lg"></div>
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-11 w-28 bg-slate-200 rounded-xl"></div>)}
        </div>
        <div className="h-96 bg-white border border-slate-100 rounded-[2rem] w-full p-8 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-200 rounded-2xl"></div>
              <div className="space-y-2">
                <div className="h-6 w-32 bg-slate-200 rounded-lg"></div>
                <div className="h-4 w-48 bg-slate-100 rounded-lg"></div>
              </div>
            </div>
            <div className="h-8 w-20 bg-slate-200 rounded-xl"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-6 w-48 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-3xl font-black text-brand-navy tracking-tight mb-3">Failed to load client</h2>
        <p className="text-slate-500 font-medium mb-8 max-w-md mx-auto">{error || "This client profile could not be found or the data is missing."}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-10 py-4 bg-brand-navy hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-colors shadow-xl shadow-brand-navy/20"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/clients" className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-brand-navy">{client.name}</h1>
          <p className="text-sm text-slate-500">Client Profile</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === t.id ? "bg-brand-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              {client.logo ? (
                <img src={client.logo} alt="" className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-brand-navy/10 flex items-center justify-center text-brand-navy font-black text-xl">
                  {getInitials(client.name)}
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-brand-navy">Overview</h2>
                <p className="text-sm text-slate-500">Client details and contract</p>
              </div>
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-brand-navy font-bold text-sm">
                <Edit2 size={16} /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border text-slate-600 font-bold text-sm">Cancel</button>
                <button onClick={handleSaveOverview} className="px-4 py-2 rounded-xl bg-brand-navy text-white font-bold text-sm">Save</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {["name", "brn", "address", "contact_person", "phone", "email", "contract_start", "contract_end", "guards_required", "notes"].map((f) => (
              <div key={f}>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">{f.replace(/_/g, " ")}</label>
                {editing ? (
                  f === "notes" ? (
                    <textarea value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full px-4 py-3 rounded-xl border" rows={3} />
                  ) : (
                    <input type={f.includes("date") ? "date" : f === "guards_required" ? "number" : "text"} value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full px-4 py-3 rounded-xl border" />
                  )
                ) : (
                  <p className="font-bold text-brand-navy">{form[f] ?? "—"}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "guards" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <h2 className="text-xl font-black text-brand-navy mb-6">Assigned Guards</h2>
          <div className="space-y-3">
            {guards.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-4 px-5 rounded-xl border bg-slate-50">
                <div>
                  <p className="font-bold text-brand-navy">{g.full_name}</p>
                  <p className="text-xs text-slate-500">{g.rank || "—"} · {g.template_name}</p>
                </div>
                <Link to={`/guards/${g.guard_id}`} className="text-xs font-bold text-brand-navy">View →</Link>
              </div>
            ))}
            {guards.length === 0 && <p className="text-slate-500 py-8 text-center">No guards assigned. Add via Scheduling → Assignments.</p>}
          </div>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-brand-navy">Attendance</h2>
            <div className="flex gap-2">
              <input type="month" value={`${attYear}-${String(attMonth).padStart(2, "0")}`} onChange={(e) => { const [y, m] = e.target.value.split("-"); setAttYear(Number(y)); setAttMonth(Number(m)); }} className="px-4 py-2 rounded-xl border" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-black">Guard</th>
                  <th className="text-left py-3 font-black">Date</th>
                  <th className="text-left py-3 font-black">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-3">{a.full_name}</td>
                    <td className="py-3">{a.date}</td>
                    <td className="py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${a.status === "P" ? "bg-emerald-50 text-emerald-600" : a.status === "A" ? "bg-red-50 text-red-600" : "bg-slate-100"}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attendance.length === 0 && <p className="text-slate-500 py-8 text-center">No attendance data for this month.</p>}
          </div>
        </div>
      )}

      {activeTab === "invoice" && (
        <div className="space-y-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="text-xl font-black text-brand-navy mb-4">Guard Requirements & Billing Rates</h2>
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 font-black">Shift</th>
                  <th className="py-3 font-black">Rank</th>
                  <th className="py-3 font-black">Required</th>
                  <th className="py-3 font-black">Day Rate (LKR)</th>
                  <th className="py-3 font-black">Night Rate (LKR)</th>
                </tr>
              </thead>
              <tbody>
                {billingRates.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-3">{r.shift}</td>
                    <td className="py-3">{r.rank}</td>
                    <td className="py-3">{r.required_count}</td>
                    <td className="py-3">{r.day_rate?.toLocaleString() ?? "—"}</td>
                    <td className="py-3">{r.night_rate?.toLocaleString() ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 flex-wrap items-end">
              <input placeholder="Shift" value={newRate.shift} onChange={(e) => setNewRate({ ...newRate, shift: e.target.value })} className="px-3 py-2 rounded-lg border w-24" />
              <input placeholder="Rank" value={newRate.rank} onChange={(e) => setNewRate({ ...newRate, rank: e.target.value })} className="px-3 py-2 rounded-lg border w-24" />
              <input placeholder="Day Rate" type="number" value={newRate.day_rate} onChange={(e) => setNewRate({ ...newRate, day_rate: e.target.value })} className="px-3 py-2 rounded-lg border w-28" />
              <input placeholder="Night Rate" type="number" value={newRate.night_rate} onChange={(e) => setNewRate({ ...newRate, night_rate: e.target.value })} className="px-3 py-2 rounded-lg border w-28" />
              <button onClick={handleAddRate} className="px-4 py-2 rounded-lg bg-brand-navy text-white font-bold text-sm flex items-center gap-2"><Plus size={16} /> Add Row</button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="text-xl font-black text-brand-navy mb-4">Generate Invoice</h2>
            <div className="flex gap-4 items-center mb-6">
              <input type="month" value={`${invoiceYear}-${String(invoiceMonth).padStart(2, "0")}`} onChange={(e) => { const [y, m] = e.target.value.split("-"); setInvoiceYear(Number(y)); setInvoiceMonth(Number(m)); }} className="px-4 py-3 rounded-xl border" />
              <button onClick={handleGenerateInvoice} className="px-6 py-3 rounded-xl bg-brand-navy text-white font-bold">Generate Invoice — {format(new Date(invoiceYear, invoiceMonth - 1), "MMMM yyyy")}</button>
            </div>

            {invoicePreview && (
              <div className="border rounded-xl p-6 bg-slate-50">
                <h3 className="font-black text-brand-navy mb-4">INVOICE PREVIEW — {client.name} — {format(new Date(invoiceYear, invoiceMonth - 1), "MMMM yyyy")}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-black">Guard</th>
                      <th className="text-left py-2 font-black">Rank</th>
                      <th className="text-left py-2 font-black">Shift</th>
                      <th className="text-right py-2 font-black">Days</th>
                      <th className="text-right py-2 font-black">Rate</th>
                      <th className="text-right py-2 font-black">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicePreview.lines?.map((l: any, i: number) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{l.guard_name}</td>
                        <td className="py-2">{l.rank}</td>
                        <td className="py-2">{l.shift}</td>
                        <td className="py-2 text-right">{l.effective_days}</td>
                        <td className="py-2 text-right">{l.rate?.toLocaleString()}</td>
                        <td className="py-2 text-right">{l.amount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-right font-black text-lg mt-4">TOTAL: LKR {invoicePreview.total?.toLocaleString()}</p>
              </div>
            )}

            <h3 className="font-black text-brand-navy mt-8 mb-4">Invoice History</h3>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3 px-4 rounded-xl border">
                  <div>
                    <p className="font-bold">{format(new Date(inv.year, inv.month - 1), "MMMM yyyy")}</p>
                    <p className="text-xs text-slate-500">{inv.invoice_no} · LKR {inv.total?.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === "Finalised" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{inv.status}</span>
                    {inv.status === "Draft" && <button onClick={() => handleFinaliseInvoice(inv.id)} className="text-xs font-bold text-brand-navy">Finalise</button>}
                    <a href={`/api/clients/${id}/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-navy flex items-center gap-1"><Download size={14} /> Download</a>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && <p className="text-slate-500 py-4">No invoices yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <h2 className="text-xl font-black text-brand-navy mb-6">Documents</h2>
          <p className="text-slate-500">Contract and renewal documents. Upload coming soon.</p>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <h2 className="text-xl font-black text-brand-navy mb-6">History</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-4 py-3 border-b">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><History size={14} /></div>
                <div>
                  <p className="font-bold">{h.action}</p>
                  <p className="text-xs text-slate-500">{h.details} · {h.changed_at}</p>
                </div>
              </div>
            ))}
            {history.length === 0 && <p className="text-slate-500 py-4">No history yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
