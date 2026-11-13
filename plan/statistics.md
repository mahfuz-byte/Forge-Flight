# Statistics & AI Business Analytics Feature Plan (DeepSeek / Ollama Engine)

> **Feature Goal:** Provide an exclusive, AI-powered business analytics dashboard for startup founders on **Forge & Flight**. Founders can upload business files (CSV or PDF) containing sales transactions, customer details, and costings. The system automatically computes core financial and cohort metrics, and upon clicking **"Analyze"**, leverages **DeepSeek (via local Ollama)** to generate deep strategic insights, growth recommendations, and interactive visual charts — running 100% locally and privately with **zero API keys**.

---

## 1. Access Control & User Eligibility Rule

* **The Golden Rule:** The Statistics feature is strictly reserved for users who have created and own at least one startup on Forge & Flight.
* **Access Scenarios:**
  1. **Unauthenticated User:** Redirected to `/login`.
  2. **Authenticated User without any created Startups (`myStartups.length === 0`):** 
     - Render an inviting gate page: *"Exclusive to Startup Founders"*.
     - Explain how Forge & Flight AI Analytics works.
     - Provide a prominent **"Create a Startup"** action button that opens the `CreateStartupModal`.
  3. **Authenticated User with 1 or more created Startups:**
     - Immediate access to the Statistics dashboard.
     - If the founder has multiple startups, provide a clean dropdown selector to switch between their startups.
  4. **Founder Dashboard Integration:**
     - Also embedded directly as a dedicated tab inside `FounderDashboard.jsx` (`/dashboard/:id`), which already validates that `currentUser.id === s.ownerId`.
  5. **Backend Verification:**
     - Every upload and analysis endpoint checks that `request.user == startup.owner` (HTTP 403 Forbidden if not the verified owner).

---

## 2. AI Engine Architecture: DeepSeek via Local Ollama

### 2.1 Why Local DeepSeek via Ollama?
* **100% Free & Private:** No subscription fees, no credit card required, and sensitive financial/customer data never leaves your computer.
* **Zero API Keys:** Operates directly through the local Ollama daemon at `http://localhost:11434`.
* **Deep Business Reasoning:** DeepSeek-R1 (or Qwen 2.5) excels at financial mathematics, logic, and structured JSON output.
* **Resilient Architecture:** Configurable provider in `backend/.env` with graceful fallback handling.

### 2.2 Environment Configuration (`backend/.env`)
```env
# AI Engine Configuration
AI_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=deepseek-r1:8b
```

---

## 3. Data Ingestion: CSV & PDF Support

### 3.1 CSV File Support
* Supports columns with alias matching:
  * `date` (`order_date`, `month`, `timestamp`)
  * `customer_name` (`customer`, `client`, `buyer`, `company`)
  * `customer_email` (`email`, `contact`)
  * `customer_segment` (`segment`, `tier`, `type`)
  * `sales_amount` (`sales`, `revenue`, `price`, `amount`)
  * `cost_amount` (`cost`, `costing`, `expense`, `cogs`)
  * `category` (`product`, `cost_category`, `item`)
* Parsed via `pandas` to aggregate totals, calculate margins, and build customer cohorts.

### 3.2 PDF Document Support
* Supports uploaded financial statements, sales invoices, or business summaries.
* Extracted via `pdfplumber` to pull text and tabular data before passing to DeepSeek.

### 3.3 Built-in Sample CSV Template
* A **"Download Sample CSV"** button is embedded directly in the UI with realistic sales and cost records.

---

## 4. End-to-End System Workflow

```
[ Founder (React UI) ]
      │
      ├── 1. Uploads business CSV or PDF (Sales, Customers, Costs)
      ▼
[ Django Backend: /api/statistics/upload/ ]
      │
      ├── 2. Validates file format, security & startup ownership
      ├── 3. Math & Aggregation Engine (pandas / pdfplumber) computes:
      │      - Total Revenue, Total Cost, Net Profit, Margin %
      │      - Customer metrics (ARPU, Top Customers, Cohorts)
      │      - Time-series monthly revenue & expenses
      ├── 4. Saves raw dataset in PostgreSQL
      ▼
[ User clicks "Analyze with DeepSeek" ]
      │
      ├── 5. POST /api/statistics/<id>/analyze/
      ▼
[ Local DeepSeek AI (via Ollama API) ]
      │
      ├── 6. Evaluates business health, customer concentration, burn rate
      ├── 7. Generates structured JSON:
      │      - Health Score (0-100)
      │      - Executive Summary & Growth Trajectory
      │      - Key Strengths & Critical Bottlenecks
      │      - Actionable Recommendations
      │      - Chart Datasets & Plot Annotations
      ▼
[ React Frontend: Interactive Dashboard ]
      │
      └── 8. Renders interactive SVG/Canvas charts + AI Strategy Report
```

---

## 5. Implementation Roadmap

### Phase 1: Backend Setup & Dependencies
- [x] Install Python packages: `ollama`, `pandas`, `pdfplumber`.
- [x] Create `backend/statistics_app` Django app.
- [x] Add model `StartupStatisticsReport` (startup FK, uploaded_by FK, file, metrics_summary, ai_analysis, status).
- [x] Register in `config/settings.py` and run migrations.

### Phase 2: Data Extraction & Calculation Services
- [x] Implement `services/data_extractor.py` for robust CSV and PDF parsing.
- [x] Implement financial math calculation (Revenue, Costs, Profit, Margin, ARPU, Top Customers).
- [x] Implement sample CSV generator endpoint.

### Phase 3: DeepSeek / Ollama AI Analyzer
- [x] Implement `services/ai_service.py` to prompt DeepSeek via Ollama with JSON formatting.
- [x] Add graceful fallback if Ollama service is still downloading or offline.

### Phase 4: REST API Endpoints
- [x] `GET /api/statistics/?startup=<slug>`: Fetch existing reports for a startup.
- [x] `POST /api/statistics/upload/`: Upload CSV/PDF and compute instant baseline metrics.
- [x] `POST /api/statistics/<id>/analyze/`: Trigger DeepSeek AI analysis.
- [x] `GET /api/statistics/sample-csv/`: Downloadable template CSV.

### Phase 5: React Frontend UI & Interactive Charts
- [x] Add **"Statistics"** link to `src/components/LeftNav.jsx`.
- [x] Add route `/statistics` in `src/App.jsx`.
- [x] Build `src/pages/Statistics.jsx`:
  - Founder Gate (`myStartups.length === 0` vs `>= 1`).
  - Startup dropdown switcher.
  - Drag-and-drop CSV/PDF upload zone + sample download button.
  - Pre-analysis KPI cards + table preview.
  - **"Analyze with DeepSeek"** button with animated progress.
  - Interactive charts (Revenue vs. Costs, Top Customers, Cost Breakdown).
  - DeepSeek Strategy scorecard (Health Score dial, recommendations checklist).
- [x] Build dedicated styling `src/styles/statistics.css`.

### Phase 6: End-to-End Verification
- [x] Test CSV upload and metrics calculation.
- [x] Test PDF upload and text extraction.
- [x] Test DeepSeek analysis response and chart rendering.
- [x] Verify founder ownership protection.
