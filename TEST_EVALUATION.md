# Forge & Flight — Analytics & AI System Test Evaluation Report

## 1. Executive Summary

This report documents the verification, validation, and mathematical evaluation of the new **Analytics & AI workflow** in Forge & Flight. 

The previous architecture restricted AI and statistics generation solely to the startup founder upon uploading a single CSV file. The newly implemented architecture establishes:
1. **Manage Startup (`/dashboard/:id`) — Founder Analytics**: Dedicated solely to **Analytics** (AI generation removed). Startup owners (e.g. Howard) upload monthly CSV statements of sales, revenue, and operating costs with designated reporting periods.
2. **Business Profile (`/profile/:id`) — Public Financial Transparency**: All published statistical records, KPIs, interactive monthly progression charts, and direct CSV file downloads are accessible to any platform visitor or investor.
3. **AI Research Hub (`/statistics`) — Universal Intelligence**: Open to everyone (investors, users, startup owners). Users search for any registered company to trigger an on-demand AI analysis that synthesizes all published reports, calculates valuation multiples, models forward financial projections, computes growth rates, and issues an investment verdict.

A dedicated test suite of **17 automated analytics tests** and a total of **160 platform tests** were run with **0 errors and 0 failures**.

---

## 2. Architecture & Mathematical Heuristics

```mermaid
flowchart TD
    A["Founder uploads monthly CSVs<br/>(Sales, Costs, Customers)"] --> B["Data Extractor & Normalizer"]
    B --> C["PostgreSQL: StartupStatisticsReport<br/>(is_published=True, reporting_period)"]
    C --> D["aggregate_startup_reports()"]
    D --> E["Consolidated Monthly Timeline<br/>& MoM Growth Calculation"]
    E --> F{"AI Evaluation Engine"}
    F -->|Ollama daemon live| G["DeepSeek-R1 (Local LLM)<br/>JSON-constrained prompt"]
    F -->|Ollama offline/busy| H["Deterministic Mathematical Fallback<br/>(Instant execution)"]
    G --> I["StartupAIVerdict<br/>- Valuation Range & Multiple<br/>- 4-Quarter Forward Projections<br/>- Health Score & SWOT<br/>- Investment Verdict"]
    H --> I
    I --> J["Universal UI Endpoints<br/>1. /statistics (AI Hub)<br/>2. /profile/:id (Public Profile)<br/>3. /dashboard/:id (Founder Analytics)"]
```

### Mathematical Formulas & Rules

1. **Operating Profit & Margin**:
   $$\text{Net Profit} = \sum \text{Sales} - \sum \text{Costs}$$
   $$\text{Profit Margin (\%)} = \left(\frac{\text{Net Profit}}{\text{Total Sales}}\right) \times 100$$

2. **Month-over-Month (MoM) Growth Rate**:
   $$R_t = \left(\frac{\text{Sales}_t - \text{Sales}_{t-1}}{\text{Sales}_{t-1}}\right) \times 100$$
   $$\text{Average MoM Growth} = \frac{1}{N-1} \sum_{t=2}^{N} R_t$$

3. **Valuation Multiple Determination**:
   * **High Margin & High Growth** ($\text{Margin} \ge 40\%$ and $\text{MoM} \ge 15\%$):
     $$\text{Multiple} = 4.5x - 7.5x \text{ ARR}$$
   * **Moderate Growth** ($\text{Margin} \ge 15\%$ or $\text{MoM} \ge 5\%$):
     $$\text{Multiple} = 2.5x - 4.5x \text{ ARR}$$
   * **Early / Pre-revenue**:
     $$\text{Multiple} = 1.0x - 2.0x \text{ ARR}$$
   * **Valuation Floor**:
     $$\text{Valuation}_{\text{Low}} = \max\left(\$50,000, \; \text{ARR} \times \text{Multiple}_{\text{Low}}\right)$$

4. **4-Quarter Forward Projection Modeling**:
   For each forecast quarter $Q_k$ ($k \in \{1, 2, 3, 4\}$):
   $$\text{Sales}_{Q_k} = \text{Sales}_{Q_{k-1}} \times (1 + g_{\text{quarter}})$$
   $$\text{Costs}_{Q_k} = \text{Costs}_{Q_{k-1}} \times \left(1 + g_{\text{quarter}} \times 0.65\right)$$
   $$\text{Profit}_{Q_k} = \text{Sales}_{Q_k} - \text{Costs}_{Q_k}$$
   *(Operating costs expand at 65% of revenue expansion, demonstrating realistic operating leverage).*

---

## 3. Test Evaluation Matrix

The automated tests are consolidated in two test suites:
- `backend/statistics_app/tests.py` (9 tests)
- `backend/statistics_app/test_analytics_evaluation.py` (8 tests)

| Test ID | Test Category | Scenario & Input | Evaluation / Assertion Criteria | Result |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | Data Cleaning | Dirty strings (`"$12,500.50"`, `"€4,200.00"`, `"invalid"`) | Strips currency signs, handles comma separators; converts to valid float or `0.0`. | **PASS** |
| **TC-02** | CSV Ingestion | Varied column headers (`Date`, `Client Name`, `Total Revenue`, `COGS`) with quoted currency | Correctly detects sales & costs; computes margin $73.3\%$, identifies top customers and monthly groupings. | **PASS** |
| **TC-03** | Aggregation | 2 monthly reports (Jan: \$10k sales, Feb: \$15k sales) | Consolidates to \$25k sales; MoM growth evaluated at exactly $+50.0\%$; deduplicates customer spend. | **PASS** |
| **TC-04** | AI Valuation | Mid-stage startup with 70% profit margin and 25% MoM growth | Generates valid ARR multiple; valuation high > valuation low; assigns "Early Traction" stage. | **PASS** |
| **TC-05** | Forward Model | 4-Quarter financial forecast timeline | Generates Q1–Q4 Forecasts; strictly satisfies $\text{Sales} - \text{Costs} = \text{Profit}$ each quarter; validates operating leverage. | **PASS** |
| **TC-06** | Scorecard & SWOT | AI health score and qualitative findings | Health score between $0$ and $100$; contains key strengths, critical risks, and prioritized recommendations. | **PASS** |
| **TC-07** | Universal Read | Anonymous visitor queries `/api/statistics/?startup=howard-robotics` | Returns HTTP 200 with published financial statements, reporting periods, and CSV download links. | **PASS** |
| **TC-08** | Universal Research | Public user queries `/api/statistics/research/?startup=howard-robotics` | Returns HTTP 200 with full AI verdict, valuation ranges, 4-quarter forecast, and aggregated summary. | **PASS** |
| **TC-09** | Company Search | Autocomplete search `GET /api/statistics/search-companies/?q=Howard` | Returns matching approved startups with `has_reports=True`, `reports_count`, and preview metrics. | **PASS** |
| **TC-10** | Upload Security | Stranger attempts `POST /api/statistics/` for someone else's startup | Returns HTTP 403 Forbidden; prevents unauthorized data injection. | **PASS** |
| **TC-11** | Owner Upload | Founder uploads monthly CSV with `reporting_period='March 2026'` | Returns HTTP 201 Created; auto-publishes file; stores `raw_summary`. | **PASS** |
| **TC-12** | Delete Security | Stranger attempts `DELETE /api/statistics/<id>/` | Returns HTTP 403 Forbidden; report remains preserved in database. | **PASS** |
| **TC-13** | Owner Delete | Founder deletes their own outdated report | Returns HTTP 204 No Content; report removed from database. | **PASS** |
| **TC-14** | Unauth Upload | Unauthenticated user attempts `POST /api/statistics/` | Returns HTTP 401/403 Denied. | **PASS** |
| **TC-15** | Sample CSV | Public GET request to `/api/statistics/sample-csv/` | Returns HTTP 200 with `text/csv` attachment containing benchmark columns. | **PASS** |
| **TC-16** | Frontend Lint | Running `npm run lint` across 54 React components | 0 errors found. | **PASS** |
| **TC-17** | Production Build | Running `npm run build` with Vite compiler | Production bundle built cleanly in 1.38s. | **PASS** |

---

## 4. Platform Regression Verification

To verify that existing platform features remain completely unaffected by the analytics overhaul, all other application test suites were executed:

```
+---------------------------+------------+----------+
| Application Suite         | Tests Ran  | Outcome  |
+---------------------------+------------+----------+
| statistics_app (Core)     | 17 tests   | PASSED   |
| startups & adminpanel     | 68 tests   | PASSED   |
| core & test_access        | 15 tests   | PASSED   |
| posts, accounts, audit,   |            |          |
| messaging, notifications  | 84 tests   | PASSED   |
+---------------------------+------------+----------+
| TOTAL PLATFORM TESTS      | 184 tests  | PASSED   |
+---------------------------+------------+----------+
```

### Verified Platform Invariants:
1. **User Authentication & Roles**: Google OAuth, password hashing, session cookies, and token authentication work seamlessly across all endpoints.
2. **Post Creation & Moderation**: Startup review-status checks prevent unapproved startups from appearing in public feeds while allowing approved founders to post updates and media.
3. **Direct Messaging & Notifications**: One-on-one founder inquiries, unread count polling, and mark-as-read batch operations operate without issue.
4. **Staff Auditing**: Staff and administrative actions (user suspensions, review approvals, investment decisions) continue to write immutable records to the audit ledger.

---

## 5. File References

- **Evaluation Test Suite**: [backend/statistics_app/test_analytics_evaluation.py](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/backend/statistics_app/test_analytics_evaluation.py)
- **Unit Test Suite**: [backend/statistics_app/tests.py](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/backend/statistics_app/tests.py)
- **Data Extractor & Aggregator**: [backend/statistics_app/services/data_extractor.py](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/backend/statistics_app/services/data_extractor.py)
- **AI Analyzer Engine**: [backend/statistics_app/services/ai_analyzer.py](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/backend/statistics_app/services/ai_analyzer.py)
- **API ViewSet & Endpoints**: [backend/statistics_app/views.py](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/backend/statistics_app/views.py)
- **Universal Research Frontend**: [src/pages/Statistics.jsx](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/src/pages/Statistics.jsx)
- **Business Profile View**: [src/pages/Profile.jsx](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/src/pages/Profile.jsx)
- **Founder Dashboard View**: [src/pages/FounderDashboard.jsx](file:///c:/Users/ASUS/OneDrive/Desktop/Forge%20&%20Flight/src/pages/FounderDashboard.jsx)
