// FinOps Platform Design System v1.1
// Last verified against tokens + patterns: 2026-04-13
// Location: apps/frontend/src/app/features/optimize/licenses/license-saas.service.ts

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { type LicenseEntitlementRow, type LicenseSaaSSummary } from '@shared/types/license-saas.types';
import { environment } from '@env/environment';

const CUR = 'AED';

const MOCK_ROWS: LicenseEntitlementRow[] = [
  { entitlementId:'le-001', vendor:'Microsoft',   product:'M365 E5',                  licenseType:'Subscription', licenseMetric:'Per user/mo',    entitledQty:2400, deployedQty:2400, activeQty:1812, utilizationPct:75.5, complianceStatus:'Compliant',    annualCost:2_160_000, currency:CUR, contractEndDate:'2026-08-31', autoRenewal:true,  renewalUrgency:'Attention', isByolEligible:false, isAhbEligible:false, businessUnit:'All' },
  { entitlementId:'le-002', vendor:'Microsoft',   product:'Windows Server Standard',  licenseType:'Subscription', licenseMetric:'Per core pair',  entitledQty:480,  deployedQty:480,  activeQty:480,  utilizationPct:100,  complianceStatus:'Compliant',    annualCost:842_400,   currency:CUR, contractEndDate:'2027-01-31', autoRenewal:false, renewalUrgency:'Safe',      isByolEligible:true,  isAhbEligible:true,  businessUnit:'Platform' },
  { entitlementId:'le-003', vendor:'Salesforce',  product:'Sales Cloud Enterprise',   licenseType:'Subscription', licenseMetric:'Per user/mo',    entitledQty:320,  deployedQty:320,  activeQty:188,  utilizationPct:58.8, complianceStatus:'Under_Deployed',annualCost:924_000,   currency:CUR, contractEndDate:'2026-12-31', autoRenewal:true,  renewalUrgency:'Safe',      isByolEligible:false, isAhbEligible:false, businessUnit:'Digital Products' },
  { entitlementId:'le-004', vendor:'ServiceNow',  product:'IT Service Management Pro',licenseType:'Subscription', licenseMetric:'Per user/mo',    entitledQty:600,  deployedQty:614,  activeQty:614,  utilizationPct:102.3,complianceStatus:'Over_Deployed', annualCost:1_080_000, currency:CUR, contractEndDate:'2026-06-30', autoRenewal:true,  renewalUrgency:'Urgent',    isByolEligible:false, isAhbEligible:false, businessUnit:'Platform' },
  { entitlementId:'le-005', vendor:'Oracle',      product:'Database Enterprise Edition',licenseType:'Perpetual',  licenseMetric:'Per proc',       entitledQty:48,   deployedQty:52,   activeQty:52,   utilizationPct:108.3,complianceStatus:'Over_Deployed', annualCost:3_240_000, currency:CUR, contractEndDate:'2027-03-31', autoRenewal:false, renewalUrgency:'Safe',      isByolEligible:true,  isAhbEligible:false, businessUnit:'Core Banking' },
  { entitlementId:'le-006', vendor:'Snowflake',   product:'Enterprise (On-Demand)',   licenseType:'Consumption',  licenseMetric:'Credits',        entitledQty:50000,deployedQty:50000,activeQty:38420,utilizationPct:76.8, complianceStatus:'Compliant',    annualCost:1_620_000, currency:CUR, contractEndDate:'2026-10-31', autoRenewal:true,  renewalUrgency:'Safe',      isByolEligible:false, isAhbEligible:false, businessUnit:'Data Platform' },
  { entitlementId:'le-007', vendor:'Databricks',  product:'Premium (DBU)',            licenseType:'Consumption',  licenseMetric:'DBU/hr',         entitledQty:10000,deployedQty:10000,activeQty:8240, utilizationPct:82.4, complianceStatus:'Compliant',    annualCost:2_160_000, currency:CUR, contractEndDate:'2027-06-30', autoRenewal:false, renewalUrgency:'Safe',      isByolEligible:false, isAhbEligible:false, businessUnit:'AI Research' },
  { entitlementId:'le-008', vendor:'Red Hat',     product:'RHEL Server Standard',     licenseType:'Subscription', licenseMetric:'Per socket pair',entitledQty:240,  deployedQty:240,  activeQty:240,  utilizationPct:100,  complianceStatus:'Compliant',    annualCost:384_000,   currency:CUR, contractEndDate:'2026-05-31', autoRenewal:false, renewalUrgency:'Urgent',    isByolEligible:true,  isAhbEligible:false, businessUnit:'Platform' },
  { entitlementId:'le-009', vendor:'Slack',       product:'Pro',                      licenseType:'Subscription', licenseMetric:'Per user/mo',    entitledQty:1800, deployedQty:1800, activeQty:1124, utilizationPct:62.4, complianceStatus:'Under_Deployed',annualCost:324_000,   currency:CUR, contractEndDate:'2026-09-30', autoRenewal:true,  renewalUrgency:'Safe',      isByolEligible:false, isAhbEligible:false, businessUnit:'All' },
  { entitlementId:'le-010', vendor:'Microsoft',   product:'SQL Server Enterprise',    licenseType:'Perpetual',    licenseMetric:'Per core pair',  entitledQty:96,   deployedQty:96,   activeQty:96,   utilizationPct:100,  complianceStatus:'Compliant',    annualCost:1_080_000, currency:CUR, contractEndDate:'2028-01-31', autoRenewal:false, renewalUrgency:'Safe',      isByolEligible:true,  isAhbEligible:true,  businessUnit:'Core Banking' },
  { entitlementId:'le-011', vendor:'SAP',         product:'S/4HANA Cloud',            licenseType:'Subscription', licenseMetric:'Per user/mo',    entitledQty:180,  deployedQty:180,  activeQty:162,  utilizationPct:90.0, complianceStatus:'Compliant',    annualCost:2_880_000, currency:CUR, contractEndDate:'2027-12-31', autoRenewal:false, renewalUrgency:'Safe',      isByolEligible:false, isAhbEligible:false, businessUnit:'Finance' },
  { entitlementId:'le-012', vendor:'Dynatrace',   product:'Full Stack Monitoring',    licenseType:'Subscription', licenseMetric:'Per 8GB host/hr', entitledQty:3000, deployedQty:3000, activeQty:1840, utilizationPct:61.3, complianceStatus:'Under_Deployed',annualCost:648_000,   currency:CUR, contractEndDate:'2026-11-30', autoRenewal:true,  renewalUrgency:'Safe',      isByolEligible:false, isAhbEligible:false, businessUnit:'Platform' },
];

const MOCK_SUMMARY: LicenseSaaSSummary = {
  totalLicenseSpend: 17_342_400,
  saasSpend:         4_428_000,
  totalWaste:        1_284_600,
  complianceScore:   76,
  pendingRecs:       9,
  currency:          CUR,
  renewingWithin90:  3,
};

@Injectable({ providedIn: 'root' })
export class LicenseSaaSService {
  readonly #http = inject(HttpClient);
  // SWAP TO REAL: this.#http.get<{ data: LicenseEntitlementRow[]; pagination: ... }>(`${environment.apiUrl}/optimize/licenses`, { params })
  list(query: Record<string, unknown>): Observable<{ data: LicenseEntitlementRow[]; pagination: { total: number; page: number; limit: number } }> {
    return of({ data: MOCK_ROWS, pagination: { total: MOCK_ROWS.length, page: 0, limit: 20 } }).pipe(delay(600));
  }
  // SWAP TO REAL: this.#http.get<LicenseSaaSSummary>(`${environment.apiUrl}/optimize/licenses/summary`)
  summary(): Observable<LicenseSaaSSummary> {
    return of(MOCK_SUMMARY).pipe(delay(400));
  }
}
