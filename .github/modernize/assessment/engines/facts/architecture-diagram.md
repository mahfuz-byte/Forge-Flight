# Architecture Diagram

This document shows how Forge & Flight moves data between its users, React client, Django API, persistent stores, and integrations. The first view summarizes the system boundary; the second expands the principal API workflows and data stores.

## Application Architecture

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart TD
    subgraph People["External Entities"]
        Founder["Founder"]
        Investor["Investor"]
        Operator["Collaborator"]
        Admin["Platform Admin"]
    end
    subgraph Platform["Forge and Flight Platform"]
        Web["React web application"]
        API["Django REST API"]
        DB[("PostgreSQL 16")]
        Files[("Media disk or optional S3 storage")]
        AI["Financial data analysis"]
    end
    subgraph Integrations["External Integrations"]
        Google["Google Identity"]
        Ollama["Local Ollama DeepSeek R1"]
    end

    Founder -->|"startup data, funding, and uploads"| Web
    Investor -->|"discovery and investment requests"| Web
    Operator -->|"profiles and collaboration requests"| Web
    Admin -->|"governance and moderation actions"| Web
    Web -->|"REST requests and file uploads"| API
    API -->|"startup, account, and activity records"| DB
    DB -->|"persisted application data"| API
    API -->|"validated user and startup files"| Files
    Files -->|"stored media"| API
    API -->|"financial summaries"| AI
    AI -->|"metrics and analysis results"| API
    Web -->|"sign-in request"| Google
    Google -->|"signed identity credential"| Web
    Web -->|"credential and API request"| API
    AI -->|"model prompt and results"| Ollama
    Ollama -->|"DeepSeek analysis"| AI
```

### Technology Stack Summary

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Client | React | 19.3.1 | Role-based startup, investor, collaborator, and admin user interfaces |
| Client build | Vite | 8.1.1 | Development server and production SPA build |
| API | Django | 6.0.7 | HTTP endpoints, authentication, permissions, and domain workflows |
| API | Django REST Framework | 3.17.1 | Token-authenticated REST API and serialization |
| Primary data store | PostgreSQL | 16 | Accounts, startups, funding, posts, messages, reports, and audit records |
| AI integration | Ollama with DeepSeek R1 | `deepseek-r1:1.5b` default | Local financial analysis of parsed founder uploads |
| Deployment | Vercel and Render | Managed services | Hosts the SPA and Django API; Render configuration provisions PostgreSQL |
| File storage | Django file storage | Local disk by default; optional S3-compatible storage | Stores validated avatars, resumes, startup documents, media, and analytics uploads |

### Data Storage & External Services

PostgreSQL is the source of truth for users, startups, applications, investments, community content, conversations, notifications, analytics reports, and audit events. Uploaded files are validated and stored using Django's configured file storage, which defaults to disk; S3-compatible storage is available when configured. The analytics workflow parses CSV or PDF uploads, stores extracted metrics, and sends a financial summary to Ollama for analysis. Google Identity is an optional sign-in integration; the API verifies the returned identity credential before associating it with a local account. Login throttling and site settings use Django's configured cache, which is process-local by default and can use Redis when configured. On Render, startup applies database migrations and seeds the Bangladeshi demo ecosystem and super-admin before launching the API.

### Key Architectural Decisions

- The React SPA is decoupled from the Django REST API and exchanges JSON or multipart file uploads over HTTP.
- Funding and application state changes are centralized in transactional services; sensitive actions are recorded in the audit log.
- Financial uploads are parsed server-side, with local Ollama inference and a built-in analysis fallback when the model service is unavailable.

## Component Relationships

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
```mermaid
flowchart LR
    subgraph Users["People and Client"]
        cFounder["Founder"]
        cInvestor["Investor"]
        cOperator["Collaborator"]
        cAdmin["Platform Admin"]
        cWeb["React SPA"]
    end
    subgraph ApiLayer["Django REST API"]
        cGateway["API routing and authentication"]
        cAccounts["Accounts and profiles"]
        cFunding["Startups funding and collaboration"]
        cCommunity["Posts and messaging"]
        cAdminOps["Admin moderation and audit"]
        cNotify["Notifications"]
        cStats["Statistics parsing and analysis"]
    end
    subgraph Deployment["Deployment"]
        cBootstrap["Render startup migrations and seeding"]
    end
    subgraph Stores["Data Stores"]
        cDB[("PostgreSQL")]
        cFiles[("Media disk or optional S3")]
        cCache[("LocMem or optional Redis cache")]
    end
    subgraph Services["External Services"]
        cGoogle["Google Identity"]
        cOllama["Local Ollama DeepSeek R1"]
    end

    cFounder -->|"startup, funding, and financial data"| cWeb
    cInvestor -->|"discovery and investment data"| cWeb
    cOperator -->|"profile and application data"| cWeb
    cAdmin -->|"admin and moderation commands"| cWeb
    cWeb -->|"REST JSON or multipart upload"| cGateway
    cGateway -->|"authentication and account operations"| cAccounts
    cGateway -->|"startup and funding operations"| cFunding
    cGateway -->|"community operations"| cCommunity
    cGateway -->|"privileged admin requests"| cAdminOps
    cGateway -->|"CSV or PDF report upload"| cStats
    cAccounts -->|"identity and profile records"| cDB
    cFunding -->|"startup, application, and investment records"| cDB
    cCommunity -->|"posts, conversations, and messages"| cDB
    cAdminOps -->|"role-checked changes and audit events"| cDB
    cFunding -->|"decision events"| cNotify
    cNotify -->|"notification records"| cDB
    cStats -->|"report metadata and extracted metrics"| cDB
    cStats -->|"uploaded source files"| cFiles
    cStats -->|"financial summary prompt"| cOllama
    cOllama -->|"analysis response"| cStats
    cBootstrap -->|"schema migrations and demo seed data"| cDB
    cAccounts -->|"login throttle and cached settings"| cCache
    cGateway -->|"API responses and report results"| cWeb
    cWeb -->|"sign-in request"| cGoogle
    cGoogle -->|"signed identity credential"| cWeb
    cAccounts -->|"verify credential"| cGoogle
```

### Component Inventory

| Component | Layer | Type | Responsibility |
|---|---|---|---|
| React SPA | Client | Web application | Presents platform workflows and sends API requests |
| API routing and authentication | API | REST entry point | Routes requests and enforces authentication and permissions |
| Accounts and profiles | API | Domain module | Manages local users, profile data, and Google-linked identities |
| Startups funding and collaboration | API | Domain module | Manages startup listings, investment decisions, funding, and applications |
| Posts and messaging | API | Domain module | Manages community posts, conversations, and messages |
| Admin moderation and audit | API | Admin and cross-cutting modules | Enforces admin capabilities, moderation, and sensitive-action logging |
| Notifications | API | Domain module | Persists notifications created by platform workflows |
| Statistics parsing and analysis | API | Analytics module | Validates and parses CSV/PDF reports, computes metrics, and requests AI analysis |
| Render startup migrations and seeding | Deployment | Startup process | Applies database migrations and seeds demo data and the super-admin before serving requests |
| PostgreSQL | Data | Relational database | Stores platform records and analytics results |
| Media storage | Data | File storage | Stores uploads and serves their media references |
| LocMem or Redis cache | Data | Cache | Supports login throttling and cached settings |
| Google Identity | External | Identity provider | Supplies credentials for optional Google sign-in |
| Ollama DeepSeek R1 | External | Local AI service | Generates analysis from the submitted financial summary |
