import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Users,
  Calendar,
  CreditCard,
  Building2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Search,
  X,
  DollarSign,
  UserCheck,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";

const ReportCard = ({
  title,
  description,
  icon: Icon,
  color,
  reportType,
  lastGenerated,
  searchTerm,
  onGenerate,
}: any) => {
  const matchesSearch = !searchTerm || title.toLowerCase().includes(searchTerm.toLowerCase()) || description.toLowerCase().includes(searchTerm.toLowerCase());
  if (!matchesSearch) return null;

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] hover:border-brand-navy/20 transition-all group shadow-sm hover:shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-4 rounded-2xl ${color} bg-opacity-10`}>
          <Icon className={color.replace("bg-", "text-")} size={28} />
        </div>
      </div>
      <h3 className="text-xl font-black text-brand-navy mb-2 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 font-medium mb-2 leading-relaxed">{description}</p>
      {lastGenerated && (
        <p className="text-[10px] text-slate-400 mb-4">Last generated: {format(new Date(lastGenerated.generated_at), "dd MMM yyyy")} by {lastGenerated.generated_by}</p>
      )}
      <button onClick={() => onGenerate(reportType)} className="flex items-center gap-2 text-brand-navy text-[10px] font-black uppercase tracking-widest hover:gap-3 transition-all">
        <span>Generate Report</span>
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState("");
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [lastGenerated, setLastGenerated] = useState<Record<string, any>>({});
  const [configOpen, setConfigOpen] = useState<string | null>(null);
  const [config, setConfig] = useState<any>({});
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewReportType, setPreviewReportType] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [guards, setGuards] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then(setClients);
    fetch("/api/guards").then((r) => r.json()).then(setGuards);
  }, []);

  useEffect(() => {
    fetch("/api/reports/recent").then((r) => r.json()).then((reports) => {
      setRecentReports(reports);
      const byType: Record<string, any> = {};
      reports.forEach((rr: any) => { if (!byType[rr.report_type] || new Date(rr.generated_at) > new Date(byType[rr.report_type].generated_at)) byType[rr.report_type] = rr; });
      setLastGenerated(byType);
    });
  }, []);

  const runReport = async (reportType: string, params: any) => {
    const res = await fetch(`/api/reports/${reportType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    setPreviewData(data);
    setPreviewReportType(reportType);
    setConfigOpen(null);
    fetch("/api/reports/recent").then((r) => r.json()).then((reports) => {
      setRecentReports(reports);
      const byType: Record<string, any> = {};
      reports.forEach((rr: any) => { if (!byType[rr.report_type] || new Date(rr.generated_at) > new Date(byType[rr.report_type].generated_at)) byType[rr.report_type] = rr; });
      setLastGenerated(byType);
    });
  };

  const reportCategories = [
    {
      title: "Attendance Reports",
      reports: [
        { title: "Monthly Attendance Summary", description: "Detailed view of all guard attendance for the month.", icon: Calendar, color: "bg-emerald-500", type: "monthly-attendance", needsConfig: true },
        { title: "Absenteeism Report", description: "Identify guards with high absence rates and patterns.", icon: AlertCircle, color: "bg-red-500", type: "absenteeism", needsConfig: true },
        { title: "Absence & Half Day Summary", description: "All guards marked absent or half-day, grouped by month.", icon: FileText, color: "bg-blue-500", type: "absence-halfday-summary", needsConfig: true },
      ],
    },
    {
      title: "Payroll & Financials",
      reports: [
        { title: "Monthly Payroll Summary", description: "Complete breakdown of earnings and deductions.", icon: CreditCard, color: "bg-blue-500", type: "monthly-payroll", needsConfig: true },
        { title: "EPF/ETF Contribution", description: "Statutory contribution report for government filing.", icon: ShieldCheck, color: "bg-indigo-500", type: "epf-etf", needsConfig: true },
        { title: "Advance Payment Log", description: "Track all salary advances and recovery status.", icon: TrendingUp, color: "bg-amber-500", type: "advance-log", needsConfig: true },
        { title: "Food Module Report", description: "Guard-wise food deductions, vendor totals, payment status.", icon: FileText, color: "bg-amber-500", type: "food-module", needsConfig: true },
        { title: "Client Invoice Summary", description: "Invoice summary per client with total revenue.", icon: DollarSign, color: "bg-emerald-500", type: "client-invoice-summary", needsConfig: true },
      ],
    },
    {
      title: "Personnel & Clients",
      reports: [
        { title: "Active Guard List", description: "Full directory of currently employed security staff.", icon: Users, color: "bg-blue-500", type: "active-guards", needsConfig: false },
        { title: "Client Site Distribution", description: "Analysis of guard allocation across client sites.", icon: Building2, color: "bg-purple-500", type: "client-site-distribution", needsConfig: false },
        { title: "Contract Expiry Report", description: "Monitor upcoming client contract renewals.", icon: FileText, color: "bg-rose-500", type: "contract-expiry", needsConfig: false },
        { title: "Guard Document Expiry", description: "Documents expiring within 60 days.", icon: ShieldCheck, color: "bg-amber-500", type: "document-expiry", needsConfig: false },
        { title: "Unassigned Guards Report", description: "Active guards with no current site assignment.", icon: UserCheck, color: "bg-slate-500", type: "unassigned-guards", needsConfig: false },
        { title: "Site Coverage History", description: "Coverage % per site per month.", icon: Building2, color: "bg-indigo-500", type: "site-coverage-history", needsConfig: true },
      ],
    },
  ];

  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  const handleGenerate = (report: any) => {
    if (report.needsConfig) {
      setConfigOpen(report.type);
      setConfig({
        month: defaultMonth,
        year: defaultYear,
        client_id: "",
        guard_id: "",
        threshold: 3,
        status: "all",
        outstanding_only: false,
        dataTypes: ["guards", "attendance", "payroll"],
        dateFrom: `${defaultYear}-01-01`,
        dateTo: `${defaultYear}-12-31`,
      });
    } else {
      runReport(report.type, {});
    }
  };

  const getPreviewRows = () => {
    if (!previewData) return [];
    if (previewReportType === "custom-export") {
      const firstKey = Object.keys(previewData).find((k) => Array.isArray(previewData[k]) && previewData[k].length > 0);
      return firstKey ? previewData[firstKey].slice(0, 10) : [];
    }
    const d = previewData.data || previewData;
    if (previewData.byGuard) return previewData.byGuard?.slice(0, 10) || [];
    return Array.isArray(d) ? d.slice(0, 10) : [];
  };

  const downloadAsCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((r) => Object.values(r).map((v) => `"${v}"`).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-4xl font-black text-brand-navy tracking-tight">System Reports</h2>
        <p className="text-slate-500 font-medium mt-1">Generate and export operational and financial data</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search reports..."
          className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-5 text-brand-navy font-bold focus:outline-none focus:ring-2 focus:ring-brand-navy/10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {recentReports.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Recent Reports</h3>
          <div className="space-y-2">
            {recentReports.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2">
                <span className="font-bold text-brand-navy">{r.report_type} — {r.params ? (() => { try { const p = JSON.parse(r.params); return p.month && p.year ? `${p.month}/${p.year}` : ""; } catch { return ""; } })() : ""} — {format(new Date(r.generated_at), "dd MMM yyyy")}</span>
                <span className="text-xs text-slate-400">{r.row_count} rows</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportCategories.map((category) => (
        <div key={category.title} className="space-y-8">
          <div className="flex items-center gap-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">{category.title}</h3>
            <div className="h-px bg-slate-100 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {category.reports.map((report) => (
              <ReportCard
                key={report.title}
                {...report}
                reportType={report.type}
                lastGenerated={lastGenerated[report.type]}
                searchTerm={searchTerm}
                onGenerate={() => handleGenerate(report)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="bg-brand-navy p-10 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-brand-navy/20">
        <div className="flex items-center gap-8 text-center md:text-left">
          <div className="bg-white/10 p-5 rounded-[2rem] shadow-inner">
            <FileSpreadsheet size={40} className="text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Custom Data Export</h3>
            <p className="text-white/60 text-sm font-medium">Export raw data in CSV or Excel format.</p>
          </div>
        </div>
        <button
          onClick={() => {
            setConfigOpen("custom-export");
            setConfig({ dataTypes: ["guards", "attendance", "payroll"], dateFrom: `${defaultYear}-01-01`, dateTo: `${defaultYear}-12-31` });
          }}
          className="bg-white text-brand-navy px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:bg-slate-50 shadow-xl whitespace-nowrap"
        >
          Export Raw Data
        </button>
      </div>

      {configOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-brand-navy mb-6">Configure Report</h3>
            <div className="space-y-4">
              {["monthly-attendance", "absenteeism", "absence-halfday-summary", "monthly-payroll", "epf-etf", "food-module", "client-invoice-summary"].includes(configOpen) && (
                <>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase block mb-2">Month</label>
                    <input type="month" value={`${config.year}-${String(config.month).padStart(2, "0")}`} onChange={(e) => { const [y, m] = e.target.value.split("-"); setConfig({ ...config, year: Number(y), month: Number(m) }); }} className="w-full px-4 py-3 rounded-xl border" />
                  </div>
                  {configOpen === "monthly-attendance" && (
                    <>
                      <div>
                        <label className="text-xs font-black text-slate-500 uppercase block mb-2">Client/Site</label>
                        <select className="w-full px-4 py-3 rounded-xl border" value={config.client_id} onChange={(e) => setConfig({ ...config, client_id: e.target.value })}>
                          <option value="">All Sites</option>
                          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-500 uppercase block mb-2">Guard</label>
                        <select className="w-full px-4 py-3 rounded-xl border" value={config.guard_id} onChange={(e) => setConfig({ ...config, guard_id: e.target.value })}>
                          <option value="">All Guards</option>
                          {guards.filter((g: any) => g.status === "Active").map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  {configOpen === "absenteeism" && (
                    <div>
                      <label className="text-xs font-black text-slate-500 uppercase block mb-2">Threshold (days absent)</label>
                      <input type="number" value={config.threshold} onChange={(e) => setConfig({ ...config, threshold: Number(e.target.value) })} className="w-full px-4 py-3 rounded-xl border" />
                    </div>
                  )}
                  {configOpen === "absence-halfday-summary" && (
                    <div>
                      <label className="text-xs font-black text-slate-500 uppercase block mb-2">Year</label>
                      <input type="number" value={config.year} onChange={(e) => setConfig({ ...config, year: Number(e.target.value) })} className="w-full px-4 py-3 rounded-xl border" />
                    </div>
                  )}
                  {configOpen === "client-invoice-summary" && (
                    <div>
                      <label className="text-xs font-black text-slate-500 uppercase block mb-2">Status</label>
                      <div className="flex gap-2">
                        {["all", "Draft", "Finalised"].map((s) => (
                          <button key={s} onClick={() => setConfig({ ...config, status: s })} className={`px-4 py-2 rounded-xl font-bold text-sm ${config.status === s ? "bg-brand-navy text-white" : "bg-slate-100"}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {configOpen === "advance-log" && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={config.outstanding_only} onChange={(e) => setConfig({ ...config, outstanding_only: e.target.checked })} />
                    <span className="text-sm font-bold">Show only outstanding advances</span>
                  </label>
                </div>
              )}
              {configOpen === "site-coverage-history" && (
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase block mb-2">Client (optional)</label>
                  <select className="w-full px-4 py-3 rounded-xl border" value={config.client_id} onChange={(e) => setConfig({ ...config, client_id: e.target.value })}>
                    <option value="">All Clients</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {configOpen === "custom-export" && (
                <>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase block mb-2">Data Types</label>
                    <div className="flex flex-wrap gap-2">
                      {["guards", "attendance", "payroll", "food", "clients"].map((t) => (
                        <label key={t} className="flex items-center gap-2">
                          <input type="checkbox" checked={config.dataTypes?.includes(t)} onChange={(e) => setConfig({ ...config, dataTypes: e.target.checked ? [...(config.dataTypes || []), t] : (config.dataTypes || []).filter((x: string) => x !== t) })} />
                          <span className="text-sm font-bold capitalize">{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase block mb-2">Date Range</label>
                    <div className="flex gap-2">
                      <input type="date" value={config.dateFrom} onChange={(e) => setConfig({ ...config, dateFrom: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border" />
                      <input type="date" value={config.dateTo} onChange={(e) => setConfig({ ...config, dateTo: e.target.value })} className="flex-1 px-4 py-3 rounded-xl border" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setConfigOpen(null)} className="flex-1 py-3 rounded-xl border font-bold">Cancel</button>
              <button onClick={() => runReport(configOpen, config).catch(console.error)} className="flex-1 py-3 rounded-xl bg-brand-navy text-white font-bold">Generate</button>
            </div>
          </div>
        </div>
      )}

      {previewData && previewReportType && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl">
            <h3 className="text-xl font-black text-brand-navy mb-4">Report Preview — First 10 rows</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {getPreviewRows().length > 0 && Object.keys(getPreviewRows()[0]).map((k) => (
                      <th key={k} className="text-left py-2 font-black text-slate-500">{k.replace(/_/g, " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getPreviewRows().map((row, i) => (
                    <tr key={i} className="border-b">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="py-2">{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.totals && (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                <p className="font-bold">Totals: Gross {previewData.totals.gross?.toLocaleString()}, Deductions {previewData.totals.deductions?.toLocaleString()}, Net {previewData.totals.net?.toLocaleString()}</p>
              </div>
            )}
            {previewData.totalRevenue !== undefined && (
              <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                <p className="font-bold">Total Revenue: LKR {previewData.totalRevenue?.toLocaleString()}</p>
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={() => { setPreviewData(null); setPreviewReportType(null); }} className="py-3 px-6 rounded-xl border font-bold">Cancel</button>
              <button onClick={() => {
                let data = previewData.data || [];
                if (previewReportType === "custom-export") {
                  Object.entries(previewData).forEach(([k, v]) => { if (Array.isArray(v) && v.length > 0) downloadAsCSV(v, `${k}-${Date.now()}`); });
                } else if (previewData.byGuard) {
                  downloadAsCSV(previewData.byGuard, `food-report-${Date.now()}`);
                } else {
                  downloadAsCSV(data, `${previewReportType}-${Date.now()}`);
                }
              }} className="py-3 px-6 rounded-xl bg-brand-navy text-white font-bold flex items-center gap-2">
                <Download size={18} /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
