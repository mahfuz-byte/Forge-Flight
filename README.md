# 🚀 Forge & Flight

> **Next-Generation Startup Incubator, Investor Matching & Venture Acceleration Ecosystem**

[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Django](https://img.shields.io/badge/Django-6.0-092e20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.17-a30000?logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Ollama](https://img.shields.io/badge/Ollama-DeepSeek--R1-black?logo=ollama&logoColor=white)](https://ollama.ai/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ed?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Forge & Flight** is a full-stack startup acceleration platform bridging founders, angel investors, venture partners, and skilled operators. Founders showcase their ventures, manage live funding rounds, publish milestone updates, and recruit collaborators. Investors discover early-stage opportunities, inspect detailed founder metrics, and deploy capital. The platform integrates local private AI inference via **DeepSeek-R1** on **Ollama** for automated financial health scoring, SWOT analysis, and CSV/PDF report parsing.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Key Features & Modules](#-key-features--modules)
  - [Community Feed & Content Engine](#1-community-feed--content-engine)
  - [Manage Startup Dashboard (Founder Control Room)](#2-manage-startup-dashboard-founder-control-room)
  - [Investor Portal & Deal Flow](#3-investor-portal--deal-flow)
  - [Collaboration & Talent Matching](#4-collaboration--talent-matching)
  - [AI Business Analytics (DeepSeek-R1)](#5-ai-business-analytics-deepseek-r1)
  - [Direct Messaging & Communication](#6-direct-messaging--communication)
  - [Platform Administration & Governance](#7-platform-administration--governance)
- [Pre-Seeded Bangladeshi Test Ecosystem](#-pre-seeded-bangladeshi-test-ecosystem)
  - [Demo Accounts Directory (20 Users)](#demo-accounts-directory)
  - [Administrator Credentials](#administrator-credentials)
- [Local Installation & Quick-Start](#-local-installation--quick-start)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Database (Docker Compose)](#2-database-docker-compose)
  - [3. Backend Setup (Django)](#3-backend-setup-django)
  - [4. AI Engine Setup (Ollama & DeepSeek)](#4-ai-engine-setup-ollama--deepseek)
  - [5. Frontend Setup (React & Vite)](#5-frontend-setup-react--vite)
- [Sample Datasets for Testing](#-sample-datasets-for-testing)
- [Project Directory Structure](#-project-directory-structure)
- [Production Deployment Guide](#-production-deployment-guide)

---

## 🏛️ System Architecture

Forge & Flight operates as a high-performance decoupled client-server architecture:

```
                      ┌────────────────────────────────────────┐
                      │          React 19 + Vite 8 SPA         │
                      │  (Vanilla CSS, Chart.js, Lucide Icons) │
                      └───────────────────┬────────────────────┘
                                          │
                         HTTP / REST APIs │ Authorization: Token <token>
                                          ▼
                      ┌────────────────────────────────────────┐
                      │       Django 6.0 REST Framework        │
                      │   (Token Auth, RBAC, Services Layer)   │
                      └───────┬───────────────┬──────────────┬─┘
                              │               │              │
                              ▼               ▼              ▼
                     ┌────────────────┐ ┌───────────┐ ┌──────────────┐
                     │ PostgreSQL 16  │ │ Local     │ │ Storage /    │
                     │ (Docker DB)    │ │ Ollama    │ │ Media Disk   │
                     │                │ │ (DeepSeek)│ │ (Avatars,    │
                     │                │ │           │ │ Decks, Res.) │
                     └────────────────┘ └───────────┘ └──────────────┘
```

- **Frontend:** React 19 single-page application powered by Vite 8 with client-side routing, optimistic state updates, theme switching (Dark/Light), and lazy-loaded administration modules.
- **Backend:** Django 6.0 REST API with strict business logic isolation (`startups/services.py`), transaction locks (`select_for_update`), atomic operations, and custom upload validation.
- **Database:** PostgreSQL 16 utilizing relational constraints, ArrayFields for fast tagging, and foreign-key referential integrity.
- **AI Analytics:** Private local inference using Ollama hosting `deepseek-r1:1.5b` with automated tabular data parsing via Pandas and document extraction via PDFPlumber.

---

## ✨ Key Features & Modules

### 1. Community Feed & Content Engine
- **Rich Post Categories:** Founders publish updates categorized by `Milestone`, `Sales Update`, `Product Launch`, `Partnership`, `Case Study`, and `Collaboration Post`.
- **Feed Filtering:** Dynamic views for *All*, *Trending*, *Funding Open*, *Collaboration*, and *Newest*.
- **Interactions:** Community likes with optimistic UI feedback, pin-to-top feature, and image/media attachments.

### 2. Manage Startup Dashboard (Founder Control Room)
Accessible at `/dashboard` or `/dashboard/<startup-slug>`, and highlighted prominently on the main dashboard feed:
- **Startup Switcher:** Easily toggle between multiple owned startups with a single click.
- **Overview & Edit:** Live preview of the public card alongside an in-place editor for Startup Name, Tagline, Industry Tags, Overview/Pitch, Funding Goal, Round Status (`soon`, `open`, `closed`), and Deadline Label.
- **Funding Gauge:** Visual progress bar tracking platform-verified capital against target goals.
- **Danger Zone:** Safe startup deletion with guards against deleting ventures with committed capital.

### 3. Investor Portal & Deal Flow
- **Investor Profiles:** Investors set budgets (e.g. `$100k-$300k`), target sectors (`FinTech`, `AgriTech`, `SaaS`), investor types (Angel, VC, Syndicate), and bio.
- **Application Inbox:** Founders view incoming capital requests showing the investor's name, avatar, proposed amount, and note.
- **Investor Portal Inspection Modal:** Clicking any investor reveals their full investor portal, portfolio links, investment thesis, and verified contact info.
- **One-Click Decisions:** Founders can **Confirm (Accept)** or **Reject** investments. Accepted funds automatically recalculate `Startup.raised` and funding percentage in atomic transactions.
- **Real-Time Notifications:** Investors immediately receive notification alerts when their proposal is accepted or declined.

### 4. Collaboration & Talent Matching
- **Open Role Publishing:** Founders publish specific roles (e.g. *Lead Full-Stack Engineer*, *Growth Lead*) with custom descriptions and toggle application availability.
- **Candidate Profiles:** Operators submit applications with custom pitch messages and portfolio links.
- **Collaborator Profile Modal:** Founders inspect candidate credentials including verified skills badges, years of experience, pitch message, portfolio URL, and uploaded resume document.
- **Accept/Decline Workflow:** Decisions instantly update candidate statuses and send in-app notifications.

### 5. AI Business Analytics (DeepSeek-R1)
Accessible at `/statistics` or directly from the Manage Startup analytics tab:
- **Zero-Cloud Local AI:** Connects to local Ollama (`http://localhost:11434`) running the `deepseek-r1:1.5b` reasoning model for private, enterprise-grade data security.
- **File Ingestion:** Drag-and-drop CSV spreadsheets or PDF financial reports (e.g. P&L, balance sheets, MRR logs).
- **Automated Metric Extraction:** Automatically computes Revenue, MRR, Operating Expenses, Churn Rate, Customer Acquisition Cost (CAC), and Lifetime Value (LTV).
- **Executive Analysis:** Generates an AI executive summary, financial health score (0–100), strategic recommendations, and SWOT analysis.
- **Interactive Visualizations:** Renders interactive Chart.js revenue trajectories, expense distributions, and growth curves.

### 6. Direct Messaging & Communication
- **Persistent Threads:** One-to-one conversation threads between founders and investors/collaborators.
- **Unread Counters:** In-app badges in the navigation bar indicating new incoming messages.
- **Polling Synchronization:** Background sync keeps threads updated across open tabs.

### 7. Platform Administration & Governance
- **Independent SPA (`/admin`):** Lazy-loaded administration suite accessible only to authorized staff.
- **Fine-Grained RBAC:** Role-Based Access Control supporting `super_admin`, `admin`, `moderator`, `finance_admin`, and `support_admin`.
- **Startup Review Queue:** Platform-level vetting for newly submitted startups before public indexing.
- **Audit Logging:** Append-only cryptographic audit trail recording sensitive platform actions, investments, status shifts, and logins.

---

## 🇧🇩 Pre-Seeded Bangladeshi Test Ecosystem

Forge & Flight includes a comprehensive data seeding script (`backend/seed_bangladesh_data.py`) that populates **20 realistic Bangladeshi startups** across various sectors, **20 verified users** (founders, angels, and operators), active investments, collaboration postings, message threads, and sales updates.

### Demo Accounts Directory

> 💡 **Common Password for all 20 demo accounts:** `DemoPass2026!#`  
> *All accounts are pre-activated, email-verified, and ready for immediate login.*

| # | Name | Email | Persona / Role | Startup Owned | Sector |
|---|------|-------|----------------|---------------|--------|
| **1** | Tanvir Ahmed | `tanvir.ahmed@demo.bd` | Founder & Collaborator | **Chaldal Quick** | Quick-Commerce / Logistics |
| **2** | Anika Rahman | `anika.rahman@demo.bd` | Founder & Angel Investor | **BongoPay** | FinTech / Cross-Border |
| **3** | Farhan Kabir | `farhan.kabir@demo.bd` | Founder & Tech Lead | **KrishiLink** | AgriTech / Cold Chain |
| **4** | Dr. Nusrat Jahan | `nusrat.jahan@demo.bd` | Founder & Medical Director | **Sheba Care** | HealthTech / Telemedicine |
| **5** | Shakib Al Hasan | `shakib.hasan@demo.bd` | Founder & Hardware Lead | **Dhaka Ride** | CleanTech / EV Mobility |
| **6** | Mehedi Hasan | `mehedi.hasan@demo.bd` | Founder & EdTech Architect | **Pathshala AI** | EdTech / Bangla NLP |
| **7** | Tasnim Tabassum | `tasnim.tabassum@demo.bd` | Founder & D2C Marketer | **Shilpo Craft** | Cultural D2C / Handicrafts |
| **8** | Arifur Rahman | `arifur.rahman@demo.bd` | Founder & Logistics Director | **Padma Logistics** | B2B Freight / Trucking |
| **9** | Sadia Islam | `sadia.islam@demo.bd` | Founder & HR Specialist | **Kormo Hub** | HRTech / Talent Verification |
| **10** | Rashedul Karim | `rashedul.karim@demo.bd` | Founder & Venture Partner | **Shonar Bangla Solar** | CleanTech / Industrial Solar |
| **11** | Tahmina Akter | `tahmina.akter@demo.bd` | Founder & Microfinance Lead | **Shonchoy Micro** | Micro-FinTech / Savings |
| **12** | Zaved Iqbal | `zaved.iqbal@demo.bd` | Founder & Angel Investor | **DokanCloud** | RetailTech / Merchant SaaS |
| **13** | Nafis Fuad | `nafis.fuad@demo.bd` | Founder & Operations Lead | **Shobuj Waste** | CleanTech / Circular Economy |
| **14** | Dr. Ishrat Jahan | `ishrat.jahan@demo.bd` | Founder & Chief Scientist | **Medix Genomics** | BioTech / DNA Diagnostics |
| **15** | Mahir Faysal | `mahir.faysal@demo.bd` | Founder & F&B Operator | **Khaddo Kitchens** | FoodTech / Cloud Kitchens |
| **16** | Samia Chowdhury | `samia.chowdhury@demo.bd` | Founder & Cyber Angel | **Nirapod Cyber** | CyberSecurity / e-KYC |
| **17** | Naimur Rahman | `naimur.rahman@demo.bd` | Founder & PropTech Lead | **BariKhoj** | PropTech / Zero-Commission |
| **18** | Humaira Begum | `humaira.begum@demo.bd` | Founder & AI Researcher | **Khamar Smart** | AgriTech / Livestock Biometrics |
| **19** | Asif Mahmud | `asif.mahmud@demo.bd` | Founder & Cleantech VC | **Cholo Electric** | CleanTech / EV Infrastructure |
| **20** | Raisa Zaman | `raisa.zaman@demo.bd` | Founder & Corporate Lawyer | **AinSeva Online** | LegalTech / RJSC Automation |

### Administrator Credentials

| Role | Email | Password | Access Portals |
|------|-------|----------|----------------|
| **Super Admin** | `admin@forgeflight.com` | `ForgeAdmin2026!#` | `/admin` (App Admin Panel) & `http://localhost:8000/admin/` (Django Admin) |

---

## 🛠️ Local Installation & Quick-Start

### Prerequisites
- **Git**
- **Node.js** (v20+ recommended) & **npm**
- **Python** (v3.11+ or v3.12+)
- **Docker Desktop** (for PostgreSQL)
- **Ollama** (for local DeepSeek AI stats)

---

### 1. Clone Repository

```bash
git clone https://github.com/mahfuz-byte/Forge-Flight.git
cd "Forge-Flight"
```

---

### 2. Database (Docker Compose)

Start the PostgreSQL 16 container:

```bash
cd backend
docker compose up -d
```
*Starts PostgreSQL on port `5432` with database `forge_and_flight` (user: `postgres`, password: `postgres`).*

---

### 3. Backend Setup (Django)

In the `backend/` directory:

```bash
# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Seed Bangladeshi ecosystem (20 users, 20 startups, investments, roles, posts)
python seed_bangladesh_data.py

# (Optional) Seed standard demo international startups
python manage.py seed_demo

# Start Django development server
python manage.py runserver 0.0.0.0:8000
```
Verify the API is operational at: **http://localhost:8000/api/health/** (`{"status":"ok"}`).

---

### 4. AI Engine Setup (Ollama & DeepSeek)

For AI Business Statistics parsing and financial health evaluation:

1. Install [Ollama](https://ollama.ai/).
2. Pull and start the DeepSeek reasoning model:
   ```bash
   ollama run deepseek-r1:1.5b
   ```
3. Ollama runs locally on `http://localhost:11434`. The Django backend communicates with it via the `ollama-python` library.

---

### 5. Frontend Setup (React & Vite)

Open a **new terminal window** in the project root directory:

```bash
cd "Forge-Flight"

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## 📊 Sample Datasets for Testing

The repository includes pre-built financial datasets located in the root folder, ready to test the **DeepSeek AI Statistics** engine at `http://localhost:5173/statistics`:

| File | Industry / Model | Key Metrics Included |
|------|------------------|----------------------|
| `test_startup_sales.csv` | Enterprise B2B SaaS | Monthly Revenue, Gross Margin, Operating Expenses, Runway |
| `test_saas_subscriptions.csv` | Subscription Micro-SaaS | MRR, ARR, Churn Rate, ARPU, Net Revenue Retention |
| `test_hardware_deeptech.csv` | Hardware & CleanTech | Unit COGS, Bill of Materials, Factory CapEx, Pilot Offtake |
| `test_ecommerce_marketplace.csv` | Quick-Commerce & Logistics | Gross Merchandise Value (GMV), Take Rate, Delivery Cost, CAC |

Upload any of these CSV files on `/statistics` to view live AI-generated SWOT insights, financial health meters, and interactive Chart.js graphs.

---

## 📁 Project Directory Structure

```
Forge-Flight/
├── backend/                        # Django REST API Backend
│   ├── accounts/                   # User model, profiles (Investor/Collaborator), Auth
│   ├── adminpanel/                 # Capability-based administrative API endpoints
│   ├── audit/                      # Append-only security audit log
│   ├── config/                     # Django settings, root URLs, WSGI/ASGI
│   ├── core/                       # Upload security validators, media serving, health
│   ├── messaging/                  # Conversations and persistent message threads
│   ├── moderation/                 # User reporting and content moderation rules
│   ├── notifications/              # Real-time event notifications engine
│   ├── posts/                      # Feed updates, sales posts, and likes
│   ├── startups/                   # Startups, funding logic, roles, investments
│   ├── statistics_app/             # Ollama DeepSeek-R1 AI stats and document parsing
│   ├── seed_bangladesh_data.py     # Comprehensive 20-startup Bangladeshi seeder
│   ├── requirements.txt            # Python dependencies
│   └── docker-compose.yml          # PostgreSQL 16 container definition
│
├── src/                            # React 19 Frontend
│   ├── admin/                      # Lazy-loaded Platform Admin Panel SPA
│   ├── api/                        # Axios/Fetch API client and token management
│   ├── components/                 # Reusable UI components (LeftNav, Topbar, Modals)
│   ├── context/                    # AppContext global state provider
│   ├── data/                       # Fallback static datasets and metadata
│   ├── pages/                      # Application route views:
│   │   ├── Feed.jsx                # Main discovery dashboard & quick-access banner
│   │   ├── FounderDashboard.jsx    # Manage Startup suite (Portals, Posts, Edit)
│   │   ├── Statistics.jsx          # DeepSeek AI Business Statistics interface
│   │   ├── Profile.jsx             # Public Startup page with team & funding gauge
│   │   ├── AccountProfile.jsx      # User profile, portfolio, and application status
│   │   ├── Messages.jsx            # 1-to-1 direct messaging center
│   │   ├── Notifications.jsx       # Notification feed
│   │   └── Explore.jsx             # Search startups, industries, and founders
│   ├── styles/                     # CSS stylesheets (Dark/Light themes)
│   ├── App.jsx                     # Route definitions and site layout
│   └── main.jsx                    # Vite application entry point
│
├── test_*.csv                      # Sample test financial datasets
├── package.json                    # Frontend dependencies & scripts
├── vite.config.js                  # Vite configuration & build rules
└── README.md                       # Comprehensive platform documentation
```

---

## 🚢 Production Deployment Guide

### Backend on Render (Web Service + PostgreSQL)
1. Provision a PostgreSQL instance (e.g. Supabase or Render Managed PostgreSQL).
2. Connect your GitHub repository to Render using `render.yaml`.
3. Configure the following environment variables on Render:
   - `DATABASE_URL`: Session-pooled PostgreSQL connection string.
   - `DJANGO_SECRET_KEY`: High-entropy secret key.
   - `DJANGO_ALLOWED_HOSTS`: `.onrender.com,yourdomain.com`.
   - `DJANGO_CORS_ALLOWED_ORIGINS`: Production Vercel URL (e.g. `https://forge-flight.vercel.app`).
   - `DJANGO_CSRF_TRUSTED_ORIGINS`: Production Vercel URL.
   - `DJANGO_SERVE_MEDIA`: `True` (or configure S3 bucket credentials).

### Frontend on Vercel
1. Import the repository into Vercel as a **Vite** project.
2. Root Directory: `./` | Build Command: `npm run build` | Output Directory: `dist`.
3. Configure Environment Variables:
   - `VITE_API_URL`: Your Render backend HTTPS URL (e.g. `https://forge-flight.onrender.com/api`).
   - `VITE_GOOGLE_CLIENT_ID`: (Optional) Google OAuth Web Client ID.
4. Deploy.

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute for educational, commercial, or research purposes.
