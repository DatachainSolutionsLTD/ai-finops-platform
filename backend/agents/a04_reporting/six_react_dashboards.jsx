/**
 * A04 Reporting & Analytics Agent — 6 React Dashboard Templates
 * FSD Reference: A04 Flow 2 (Interactive Dashboard Rendering), Steps 11–19
 * 
 * Dashboards (per FSD Seed scope):
 *   1. ExecutiveDashboard     — CxO-level KPIs, spend trend, forecast overlay
 *   2. ProviderBreakdown      — Spend by cloud provider with drill-down
 *   3. BusinessUnitCost       — BU-level cost analysis with chargeback
 *   4. ApplicationCost        — Application-level resource utilization
 *   5. AnomalySummary         — Active anomalies, severity heatmap, MTTR
 *   6. AllocationView         — Coverage rate, unattributed costs, rule status
 *
 * Tech: React 18 + Recharts + Tailwind CSS + shadcn/ui
 * Data: Fetched from A04 API (/api/v1/reporting/dashboards/*)
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, Treemap,
} from "recharts";

// ============================================================================
// Shared Components
// ============================================================================

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

const KPICard = ({ label, value, change, trend, icon }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      {icon && <span className="text-gray-400">{icon}</span>}
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {change !== undefined && (
      <div className={`text-sm mt-1 ${trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-gray-400"}`}>
        {trend === "up" ? "▲" : trend === "down" ? "▼" : "→"} {change}
      </div>
    )}
  </div>
);

const DashboardHeader = ({ title, timeRange, onTimeRangeChange }) => (
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
    <div className="flex gap-2">
      {["Last_7d", "Last_30d", "Last_90d", "MTD", "QTD", "YTD"].map((r) => (
        <button
          key={r}
          onClick={() => onTimeRangeChange(r)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            timeRange === r ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {r.replace("_", " ")}
        </button>
      ))}
    </div>
  </div>
);

const ChartCard = ({ title, children, className = "" }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-5 ${className}`}>
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    {children}
  </div>
);

const NarrativeBlock = ({ text }) => (
  <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4 mb-6">
    <h3 className="text-sm font-semibold text-blue-800 mb-2">AI-Generated Executive Summary</h3>
    <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">{text}</p>
  </div>
);

const formatSAR = (v) => `SAR ${(v || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const useAPI = (endpoint, params = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/reporting${endpoint}?${new URLSearchParams(params)}`, {
      headers: { "X-Tenant-ID": "g42-seed", Authorization: "Bearer " + (localStorage.getItem("token") || "") },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(params)]);
  return { data, loading };
};

// ============================================================================
// 1. EXECUTIVE DASHBOARD
// ============================================================================

const ExecutiveDashboard = () => {
  const [timeRange, setTimeRange] = useState("Last_30d");
  const { data, loading } = useAPI("/dashboards/executive", { time_range: timeRange });

  if (loading) return <div className="p-8 text-gray-500">Loading executive dashboard...</div>;

  const d = data || {};
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DashboardHeader title="Executive Dashboard" timeRange={timeRange} onTimeRangeChange={setTimeRange} />

      {d.narrative && <NarrativeBlock text={d.narrative} />}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KPICard label="Total Spend" value={formatSAR(d.total_spend_sar)} change={`${d.mom_change_pct}%`} trend={d.mom_change_pct > 0 ? "up" : "down"} />
        <KPICard label="Budget Utilization" value={`${d.budget_utilization_pct || 0}%`} />
        <KPICard label="Forecast Accuracy" value={`${d.forecast_accuracy_pct || 0}%`} />
        <KPICard label="Optimization Savings" value={formatSAR(d.optimization_savings_sar)} trend="down" />
        <KPICard label="Active Anomalies" value={d.active_anomalies || 0} />
        <KPICard label="Allocation Coverage" value={`${d.allocation_coverage_pct || 0}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Cloud Spend Trend (12 Months)">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={d.spend_trend_12m || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatSAR(v)} />
              <Area type="monotone" dataKey="actual_sar" stroke="#3B82F6" fill="#93C5FD" name="Actual" />
              <Area type="monotone" dataKey="budget_sar" stroke="#F59E0B" fill="none" strokeDasharray="5 5" name="Budget" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Spend by Provider">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={d.spend_by_provider || []} dataKey="total_sar" nameKey="provider" cx="50%" cy="50%" outerRadius={100} label={({ provider, percent }) => `${provider} ${(percent * 100).toFixed(0)}%`}>
                {(d.spend_by_provider || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatSAR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Top 10 Cost Drivers">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={(d.top_cost_drivers || []).slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <YAxis dataKey="service_name" type="category" width={180} />
            <Tooltip formatter={(v) => formatSAR(v)} />
            <Bar dataKey="cost_sar" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ============================================================================
// 2. PROVIDER BREAKDOWN DASHBOARD
// ============================================================================

const ProviderBreakdownDashboard = () => {
  const [timeRange, setTimeRange] = useState("Last_30d");
  const { data, loading } = useAPI("/dashboards/provider-breakdown", { time_range: timeRange });
  const d = data || {};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DashboardHeader title="Provider Cost Breakdown" timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard label="AWS Spend" value={formatSAR(d.aws_total)} change={`${d.aws_change_pct || 0}%`} trend={d.aws_change_pct > 0 ? "up" : "down"} />
        <KPICard label="Azure Spend" value={formatSAR(d.azure_total)} />
        <KPICard label="GCP Spend" value={formatSAR(d.gcp_total)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Spend by Provider Over Time">
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={d.provider_trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatSAR(v)} />
              <Area type="monotone" dataKey="aws" stackId="1" stroke="#FF9900" fill="#FF9900" fillOpacity={0.6} />
              <Area type="monotone" dataKey="azure" stackId="1" stroke="#0078D4" fill="#0078D4" fillOpacity={0.6} />
              <Area type="monotone" dataKey="gcp" stackId="1" stroke="#4285F4" fill="#4285F4" fillOpacity={0.6} />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Service Category Distribution">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={d.service_categories || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatSAR(v)} />
              <Bar dataKey="cost_sar" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

// ============================================================================
// 3. BUSINESS UNIT COST DASHBOARD
// ============================================================================

const BusinessUnitCostDashboard = () => {
  const [timeRange, setTimeRange] = useState("Last_30d");
  const { data, loading } = useAPI("/dashboards/bu-cost", { time_range: timeRange });
  const d = data || {};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DashboardHeader title="Business Unit Cost Analysis" timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Chargeback" value={formatSAR(d.total_chargeback)} />
        <KPICard label="Coverage Rate" value={`${d.coverage_pct || 0}%`} />
        <KPICard label="BUs Reporting" value={d.bu_count || 0} />
        <KPICard label="Unattributed" value={formatSAR(d.unattributed_sar)} />
      </div>
      <ChartCard title="Cost by Business Unit (MoM Comparison)">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={d.bu_costs || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bu_name" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <Tooltip formatter={(v) => formatSAR(v)} />
            <Bar dataKey="current_month" fill="#3B82F6" name="Current" radius={[4, 4, 0, 0]} />
            <Bar dataKey="previous_month" fill="#CBD5E1" name="Previous" radius={[4, 4, 0, 0]} />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ============================================================================
// 4. APPLICATION COST DASHBOARD
// ============================================================================

const ApplicationCostDashboard = () => {
  const [timeRange, setTimeRange] = useState("Last_30d");
  const { data } = useAPI("/dashboards/application-cost", { time_range: timeRange });
  const d = data || {};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DashboardHeader title="Application Cost Analysis" timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Applications Tracked" value={d.app_count || 0} />
        <KPICard label="Highest Cost App" value={d.top_app_name || "—"} />
        <KPICard label="Top App Spend" value={formatSAR(d.top_app_cost)} />
        <KPICard label="Avg Cost/App" value={formatSAR(d.avg_cost_per_app)} />
      </div>
      <ChartCard title="Top 15 Applications by Cost">
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={(d.app_costs || []).slice(0, 15)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <YAxis dataKey="app_name" type="category" width={200} />
            <Tooltip formatter={(v) => formatSAR(v)} />
            <Bar dataKey="total_sar" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ============================================================================
// 5. ANOMALY SUMMARY DASHBOARD
// ============================================================================

const AnomalySummaryDashboard = () => {
  const [timeRange, setTimeRange] = useState("Last_30d");
  const { data } = useAPI("/dashboards/anomaly-summary", { time_range: timeRange });
  const d = data || {};

  const severityColors = { Critical: "#EF4444", Warning: "#F59E0B", Informational: "#3B82F6" };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DashboardHeader title="Cost Anomaly Summary" timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <KPICard label="Active Anomalies" value={d.total_active || 0} />
        <KPICard label="Critical" value={d.critical || 0} />
        <KPICard label="Warning" value={d.warning || 0} />
        <KPICard label="MTTD (hours)" value={d.mttd_hours || "—"} />
        <KPICard label="MTTR (hours)" value={d.mttr_hours || "—"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Anomaly Trend (30 Days)">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={d.anomaly_trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="critical" stackId="1" stroke="#EF4444" fill="#FCA5A5" />
              <Area type="monotone" dataKey="warning" stackId="1" stroke="#F59E0B" fill="#FDE68A" />
              <Area type="monotone" dataKey="informational" stackId="1" stroke="#3B82F6" fill="#93C5FD" />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Anomalies by Root Cause">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={d.by_root_cause || []} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                {(d.by_root_cause || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <ChartCard title="Projected Financial Impact (Top Anomalies)">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={(d.top_anomalies || []).slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
            <YAxis dataKey="description" type="category" width={250} />
            <Tooltip formatter={(v) => formatSAR(v)} />
            <Bar dataKey="impact_30d_sar" fill="#EF4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ============================================================================
// 6. ALLOCATION VIEW DASHBOARD
// ============================================================================

const AllocationViewDashboard = () => {
  const [timeRange, setTimeRange] = useState("Last_30d");
  const { data } = useAPI("/dashboards/allocation-view", { time_range: timeRange });
  const d = data || {};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <DashboardHeader title="Cost Allocation & Coverage" timeRange={timeRange} onTimeRangeChange={setTimeRange} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Coverage Rate" value={`${d.coverage_pct || 0}%`} trend={d.coverage_pct >= 80 ? "down" : "up"} />
        <KPICard label="Active Rules" value={d.active_rules || 0} />
        <KPICard label="Direct Allocation" value={formatSAR(d.direct_sar)} />
        <KPICard label="Shared Allocation" value={formatSAR(d.shared_sar)} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Allocation by Cost Category">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={d.by_category || []} dataKey="cost_sar" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                {(d.by_category || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatSAR(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Coverage Rate Trend">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={d.coverage_trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="coverage_pct" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="target" stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={1} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD ROUTER (maps dashboard_id to component)
// ============================================================================

const DASHBOARD_REGISTRY = {
  executive: { component: ExecutiveDashboard, label: "Executive Summary" },
  "provider-breakdown": { component: ProviderBreakdownDashboard, label: "Provider Breakdown" },
  "bu-cost": { component: BusinessUnitCostDashboard, label: "Business Unit Cost" },
  "application-cost": { component: ApplicationCostDashboard, label: "Application Cost" },
  "anomaly-summary": { component: AnomalySummaryDashboard, label: "Anomaly Summary" },
  "allocation-view": { component: AllocationViewDashboard, label: "Allocation View" },
};

export default function DashboardApp() {
  const [activeDashboard, setActiveDashboard] = useState("executive");
  const ActiveComponent = DASHBOARD_REGISTRY[activeDashboard]?.component || ExecutiveDashboard;

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 bg-gray-900 text-white p-4">
        <h2 className="text-lg font-bold mb-6 text-blue-400">FinOps Dashboards</h2>
        {Object.entries(DASHBOARD_REGISTRY).map(([id, { label }]) => (
          <button
            key={id}
            onClick={() => setActiveDashboard(id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
              activeDashboard === id ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="flex-1">
        <ActiveComponent />
      </main>
    </div>
  );
}
