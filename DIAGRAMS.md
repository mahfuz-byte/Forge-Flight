# Forge & Flight — System Diagrams

> All diagrams use Mermaid syntax and render in GitHub, VS Code, and any Mermaid-compatible viewer.

---

## Table of Contents

1. Use Case Diagram
2. Entity-Relationship (ER) Diagram
3. System Architecture Diagram
4. Component Diagram (Frontend)
5. Data Flow Diagram — App Startup
6. Sequence Diagram — Login
7. Sequence Diagram — Post a Comment
8. Sequence Diagram — Apply to Collaboration Role
9. Sequence Diagram — Invest in a Startup
10. Activity Diagram — User Registration
11. Activity Diagram — Create a Startup
12. State Machine — Application Lifecycle
13. State Machine — Investment Lifecycle
14. State Machine — Startup Funding Status
15. Deployment Diagram
16. Class Diagram (Backend Models)

---

## 1. Use Case Diagram

```mermaid
graph TD
    Guest(["Guest (not logged in)"])
    User(["User (logged in)"])
    Owner(["Startup Owner"])

    Guest --> UC1["Browse startup feed"]
    Guest --> UC2["View startup profile"]
    Guest --> UC3["View posts"]
    Guest --> UC4["Register / Sign up"]
    Guest --> UC5["Log in"]

    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC6["Save a startup"]
    User --> UC7["Follow a startup"]
    User --> UC8["Post a comment"]
    User --> UC9["Apply to collaboration role"]
    User --> UC10["Invest in a startup"]
    User --> UC11["Create a startup"]
    User --> UC12["Post a feed update"]
    User --> UC13["View messages"]
    User --> UC14["View notifications"]
    User --> UC15["Edit own profile"]
    User --> UC16["Log out"]
    User --> UC17["Explore / search startups"]

    Owner --> UC6
    Owner --> UC7
    Owner --> UC8
    Owner --> UC12
    Owner --> UC18["Edit startup details"]
    Owner --> UC19["Review collaboration applications"]
    Owner --> UC20["Accept or decline an application"]
    Owner --> UC21["Review investment requests"]
    Owner --> UC22["Accept or reject an investment"]
    Owner --> UC23["Manage team members"]
    Owner --> UC24["Manage timeline events"]
    Owner --> UC25["Manage startup documents"]
    Owner --> UC26["View founder dashboard"]

    style Guest fill:#e8f4fd,stroke:#2196F3
    style User fill:#e8f5e9,stroke:#4CAF50
    style Owner fill:#fff3e0,stroke:#FF9800
```

---

## 2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    User {
        int      id          PK
        string   email       UK
        string   slug        UK
        string   first_name
        string   last_name
        text     bio
        string   location
        datetime date_joined
    }

    Startup {
        string   slug        PK
        string   name
        string   initials
        bool     verified
        int      owner       FK
        string   tagline
        string   status
        string   tags
        int      goal
        int      raised
        string   deadline
        text     overview
        datetime created_at
        datetime updated_at
    }

    CollaborationRole {
        int    id       PK
        string startup  FK
        string role
        text   body
    }

    TeamMember {
        int    id      PK
        string startup FK
        string name
        string title
        int    order
    }

    TimelineEvent {
        int    id          PK
        string startup     FK
        string date_label
        string title
        text   description
        int    order
    }

    Document {
        int    id      PK
        string startup FK
        string name
        string size
        string file
        int    order
    }

    UpdateEntry {
        int      id         PK
        string   startup    FK
        string   text
        datetime created_at
    }

    StartupComment {
        int      id         PK
        string   startup    FK
        int      author     FK
        text     text
        datetime created_at
    }

    Application {
        int      id         PK
        string   startup    FK
        int      applicant  FK
        string   role
        string   name
        string   email
        string   link
        text     message
        string   status
        datetime created_at
    }

    Investment {
        int      id         PK
        string   startup    FK
        int      investor   FK
        int      amount
        string   status
        datetime created_at
    }

    Post {
        int      id         PK
        string   startup    FK
        int      author     FK
        string   kind
        string   post_type
        string   title
        text     text
        string   tags
        string   media
        datetime created_at
    }

    Conversation {
        int      id         PK
        string   startup    FK
        int      initiator  FK
        datetime created_at
    }

    Message {
        int      id             PK
        int      conversation   FK
        int      sender         FK
        text     text
        bool     read
        datetime created_at
    }

    Notification {
        int      id         PK
        int      recipient  FK
        string   icon
        string   color
        string   text
        string   link
        bool     read
        datetime created_at
    }

    User            ||--o{  Startup             : "owns"
    User            }o--o{  Startup             : "saves"
    User            }o--o{  Startup             : "follows"
    Startup         ||--o|  CollaborationRole   : "has"
    Startup         ||--o{  TeamMember          : "has"
    Startup         ||--o{  TimelineEvent       : "has"
    Startup         ||--o{  Document            : "has"
    Startup         ||--o{  UpdateEntry         : "has"
    Startup         ||--o{  StartupComment      : "receives"
    User            ||--o{  StartupComment      : "writes"
    Startup         ||--o{  Application         : "receives"
    User            ||--o{  Application         : "submits"
    Startup         ||--o{  Investment          : "receives"
    User            ||--o{  Investment          : "makes"
    Startup         ||--o{  Post                : "authors"
    User            ||--o{  Post                : "creates"
    Startup         ||--o{  Conversation        : "has"
    User            ||--o{  Conversation        : "initiates"
    Conversation    ||--o{  Message             : "contains"
    User            ||--o{  Message             : "sends"
    User            ||--o{  Notification        : "receives"
```

---

## 3. System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Browser - Client Layer"]
        Vite["Vite Dev Server :5173"]
        React["React 19 SPA"]
        Context["AppContext - Global State"]
        ApiClient["api/client.js fetch wrapper + CSRF"]
    end

    subgraph Backend["Django Backend :8000"]
        CORS["django-cors-headers"]
        CSRF["CSRF Middleware"]
        Session["Session Middleware"]
        DRF["Django REST Framework"]

        subgraph Apps["Django Apps"]
            Core["core - health and csrf endpoints"]
            Accounts["accounts - auth and users"]
            Startups["startups - startups, comments, applications, investments"]
            Posts["posts - feed posts"]
            Messaging["messaging - conversations and messages"]
            Notifications["notifications"]
        end
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL 16 :5432 via Docker"]
        Media["Media Files backend/media/"]
    end

    Vite --> React
    React --> Context
    Context --> ApiClient
    ApiClient -- "HTTP REST JSON credentials:include X-CSRFToken" --> CORS
    CORS --> CSRF
    CSRF --> Session
    Session --> DRF
    DRF --> Apps
    Apps --> PG
    Apps --> Media

    style Client fill:#e3f2fd,stroke:#1565C0
    style Backend fill:#e8f5e9,stroke:#2E7D32
    style Data fill:#fff8e1,stroke:#F57F17
```

---

## 4. Component Diagram (Frontend)

```mermaid
graph TD
    MainJSX["main.jsx - ReactDOM.createRoot"]

    subgraph AppShell["App Shell"]
        AppJSX["App.jsx - BrowserRouter + Routes"]
        AppProvider["AppContext.Provider"]
        IconSprite["IconSprite.jsx"]
        CreatePostModal["CreatePostModal.jsx - global overlay"]
    end

    subgraph Pages["Pages (one per route)"]
        Landing["Landing.jsx  /"]
        Login["Login.jsx  /login"]
        Feed["Feed.jsx  /feed"]
        Profile["Profile.jsx  /profile/:id"]
        Explore["Explore.jsx  /explore"]
        Messages["Messages.jsx  /messages"]
        Notifications["Notifications.jsx  /notifications"]
        Settings["Settings.jsx  /settings"]
        Account["AccountProfile.jsx  /account"]
        Dashboard["FounderDashboard.jsx  /dashboard/:id"]
        Portfolio["InvestorPortfolio.jsx  /portfolio"]
    end

    subgraph Shared["Shared Components"]
        Topbar["Topbar.jsx"]
        LeftNav["LeftNav.jsx"]
        RightRail["RightRail.jsx"]
        FeedCard["FeedCard.jsx"]
        InvestButton["InvestButton.jsx"]
        CreateStartupModal["CreateStartupModal.jsx"]
        LogoBadge["LogoBadge.jsx"]
    end

    subgraph StateLayer["State and API"]
        ContextHook["useApp() hook from AppContext"]
        ApiClient2["api/client.js"]
    end

    MainJSX --> AppJSX
    AppJSX --> AppProvider
    AppJSX --> Pages
    AppJSX --> CreatePostModal

    Feed --> FeedCard
    Feed --> Topbar
    Feed --> LeftNav
    Feed --> RightRail
    Profile --> InvestButton
    Profile --> Topbar
    Dashboard --> Topbar

    Pages --> ContextHook
    Shared --> ContextHook
    ContextHook --> ApiClient2
```

---

## 5. Data Flow Diagram — App Startup

```mermaid
flowchart TD
    A([React App Mounts]) --> B["AppProvider useEffect fires"]
    B --> C["Promise.all — 3 parallel requests"]

    C --> D["GET /api/startups/"]
    C --> E["GET /api/posts/"]
    C --> F["GET /api/auth/me/"]

    D --> G["transformStartup + transformComments for each"]
    E --> H["transformPost for each"]
    F --> I{HTTP 200?}

    I -->|Yes - logged in| J["transformUser, setCurrentUser, setSignedIn true"]
    I -->|No - 401 becomes null| K["Keep GUEST_USER, setSignedIn false"]

    J --> L["Promise.all — 2 more requests"]
    L --> M["GET /api/applications/"]
    L --> N["GET /api/investments/"]
    M --> O["transformApplication, setApplications"]
    N --> P["transformInvestment, setInvestments"]

    G --> Q["setStartups, setComments"]
    H --> R["setPosts"]

    O --> S["setLoading false"]
    P --> S
    Q --> S
    R --> S
    K --> S

    S --> T([Render full UI])

    style A fill:#bbdefb
    style T fill:#c8e6c9
    style I fill:#fff9c4
```

---

## 6. Sequence Diagram — Login

```mermaid
sequenceDiagram
    actor User
    participant LoginPage as Login.jsx
    participant Context as AppContext
    participant API as api/client.js
    participant Django as Django :8000
    participant DB as PostgreSQL

    User->>LoginPage: Enter email and password, click Login
    LoginPage->>Context: login(email, password)
    Context->>API: api.post('/auth/login/', body)

    Note over API: needsCsrf=true, fetch CSRF cookie first
    API->>Django: GET /api/csrf/
    Django-->>API: Set-Cookie csrftoken

    API->>Django: POST /api/auth/login/ with X-CSRFToken header
    Django->>DB: authenticate(email, password)
    DB-->>Django: User record or null

    alt Valid credentials
        Django->>Django: login(request, user) creates session
        Django-->>API: Set-Cookie sessionid + UserSerializer JSON
        API-->>Context: user data object
        Context->>Context: setCurrentUser, setSignedIn true
        Context->>API: GET /api/applications/ and /api/investments/
        API-->>Context: arrays
        Context-->>LoginPage: resolved
        LoginPage->>LoginPage: navigate to /feed
    else Invalid credentials
        Django-->>API: 400 Invalid credentials
        API-->>Context: throws Error
        Context-->>LoginPage: throws
        LoginPage->>User: Show error message
    end
```

---

## 7. Sequence Diagram — Post a Comment

```mermaid
sequenceDiagram
    actor User
    participant Profile as Profile.jsx
    participant Context as AppContext
    participant API as api/client.js
    participant Django as Django :8000
    participant DB as PostgreSQL

    User->>Profile: Type comment text, click Submit
    Profile->>Context: addComment(startupId, text)
    Context->>API: api.post('/comments/', body)
    API->>Django: POST /api/comments/ with X-CSRFToken

    Django->>Django: serializer.is_valid()
    Django->>DB: INSERT startups_startupcomment
    DB-->>Django: saved row

    Django-->>API: 201 comment JSON
    API-->>Context: parsed comment object

    Context->>Context: setComments append to startupId array
    Context-->>Profile: state update triggers re-render
    Profile->>User: New comment appears in Comments tab
```

---

## 8. Sequence Diagram — Apply to Collaboration Role

```mermaid
sequenceDiagram
    actor Applicant
    participant Profile as Profile.jsx
    participant Context as AppContext
    participant API as api/client.js
    participant Django as Django :8000
    participant DB as PostgreSQL
    actor Founder

    Applicant->>Profile: Fill apply form and submit
    Profile->>Context: addApplication(startupId, role, name, email, link, message)
    Context->>API: api.post('/applications/', body)
    API->>Django: POST /api/applications/

    Django->>Django: applicant = request.user, status = pending
    Django->>DB: INSERT startups_application
    DB-->>Django: Application row
    Django-->>API: 201 JSON
    API-->>Context: transformApplication data
    Context->>Context: setApplications prepend new
    Context-->>Profile: re-render
    Profile->>Applicant: Application sent confirmation

    Note over Founder: Founder reviews on Dashboard later

    Founder->>Dashboard: Click Accept or Decline
    Dashboard->>Context: setApplicationStatus(id, status)
    Context->>API: api.patch('/applications/id/', status body)
    API->>Django: PATCH /api/applications/id/
    Django->>DB: UPDATE status
    DB-->>Django: Updated row
    Django-->>API: 200 JSON
    API-->>Context: updated application
    Context->>Context: replace in applications array
    Context-->>Dashboard: re-render with new status
```

---

## 9. Sequence Diagram — Invest in a Startup

```mermaid
sequenceDiagram
    actor Investor
    participant Profile as Profile.jsx
    participant InvestBtn as InvestButton.jsx
    participant Context as AppContext
    participant API as api/client.js
    participant Django as Django :8000
    participant DB as PostgreSQL
    actor Founder

    Investor->>Profile: Click Invest button
    Investor->>InvestBtn: Enter amount and confirm
    InvestBtn->>Context: addInvestment(startupId, amount)
    Context->>API: api.post('/investments/', body)
    API->>Django: POST /api/investments/

    Django->>Django: investor = request.user, status = pending
    Django->>DB: INSERT startups_investment
    DB-->>Django: Investment row
    Django-->>API: 201 JSON
    API-->>Context: transformInvestment data
    Context->>Context: setInvestments prepend new
    Context-->>InvestBtn: close modal
    InvestBtn->>Investor: Investment request sent

    Note over Founder: Founder reviews on Dashboard Investments tab

    Founder->>Dashboard: Click Accept or Reject
    Dashboard->>Context: setInvestmentStatus(id, status)
    Context->>API: api.patch('/investments/id/', status body)
    API->>Django: PATCH /api/investments/id/
    Django->>DB: UPDATE status
    DB-->>Django: Updated row
    Django-->>API: 200 JSON
    API-->>Context: updated investment
    Context->>Context: replace in investments array
```

---

## 10. Activity Diagram — User Registration

```mermaid
flowchart TD
    Start([User opens app]) --> A["Click Register"]
    A --> B["Fill form - name, email, password"]
    B --> C{Client validation OK?}
    C -->|No| B
    C -->|Yes| D["POST /api/auth/register/"]

    D --> E{RegisterSerializer valid?}
    E -->|Email taken| F["400 error - Show email already registered"]
    F --> B
    E -->|Valid| G["User.objects.create_user - auto-generate slug"]
    G --> H["Django login() - set sessionid cookie"]
    H --> I["Return 201 Created + UserSerializer JSON"]
    I --> J["AppContext: setCurrentUser, setSignedIn true"]
    J --> K["navigate to /feed"]
    K --> End([User sees feed])

    style Start fill:#bbdefb
    style End fill:#c8e6c9
    style F fill:#ffcdd2
```

---

## 11. Activity Diagram — Create a Startup

```mermaid
flowchart TD
    Start([Founder clicks Create Startup]) --> A["CreateStartupModal opens"]
    A --> B["Fill form - name, tagline, tags, overview, goal"]
    B --> C{Required fields filled?}
    C -->|No| B
    C -->|Yes| D["POST /api/startups/"]

    D --> E["StartupWriteSerializer validates"]
    E --> F["Startup.save() - auto-generate slug and initials"]
    F --> G["owner = request.user set in serializer.create"]
    G --> H["Re-serialize with StartupDetailSerializer"]
    H --> I["201 Created - full nested startup JSON"]

    I --> J["AppContext: setStartups and setComments"]
    J --> K["navigate to /dashboard/slug"]
    K --> End([Founder Dashboard opens for new startup])

    style Start fill:#bbdefb
    style End fill:#c8e6c9
```

---

## 12. State Machine — Application Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending : User submits POST /api/applications/

    Pending --> Accepted : Founder PATCHes status=accepted
    Pending --> Declined : Founder PATCHes status=declined

    Accepted --> [*] : Applicant joins as collaborator
    Declined --> [*] : Application closed

    note right of Pending
        Visible to both applicant
        and startup owner on dashboard
    end note

    note right of Accepted
        collaboratingIds in AppContext
        includes this startup slug
    end note
```

---

## 13. State Machine — Investment Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending : Investor submits POST /api/investments/

    Pending --> Accepted  : Founder PATCHes status=accepted
    Pending --> Rejected  : Founder PATCHes status=rejected
    Pending --> [*]       : Investor cancels via DELETE

    Accepted --> Completed : Off-platform deal closes

    Completed --> [*]
    Rejected  --> [*]

    note right of Pending
        amount not yet
        added to raised
    end note

    note right of Completed
        raised update is
        manual only for now
    end note
```

---

## 14. State Machine — Startup Funding Status

```mermaid
stateDiagram-v2
    [*]    --> Soon   : Startup created (default)
    Soon   --> Open   : Founder sets status=open
    Open   --> Closed : Deadline passes or manually closed
    Closed --> Open   : Founder reopens
    Soon   --> Closed : Founder skips to closed

    note right of Open
        Invest button visible
        to other users on profile
    end note

    note right of Closed
        No automatic transition yet.
        deadline is a free-text string,
        not a real DateTimeField.
    end note
```

---

## 15. Deployment Diagram

```mermaid
graph TB
    subgraph Dev["Developer Machine"]
        subgraph NodeProc["Node.js Process"]
            Vite2["Vite Dev Server :5173 — npm run dev"]
        end

        subgraph PyProc["Python 3.13 Process"]
            Django2["Django + DRF :8000 — manage.py runserver"]
            Venv["backend/venv/ — isolated pip packages"]
        end

        subgraph DockerDesktop["Docker Desktop"]
            PG2["postgres:16 container :5432 — DB: forge_and_flight"]
        end

        EnvFrontend[".env — VITE_API_URL=http://localhost:8000/api"]
        EnvBackend["backend/.env — SECRET_KEY, DB settings, CORS origins"]
    end

    Browser2["Browser — http://localhost:5173"] --> Vite2
    Vite2 -- "serves HTML/JS/CSS" --> Browser2
    Browser2 -- "XHR/fetch to :8000" --> Django2
    Django2 -- "psycopg2 to :5432" --> PG2
    Django2 -- "reads" --> EnvBackend
    Vite2 -- "reads" --> EnvFrontend
    Django2 --> Venv

    style Dev fill:#f5f5f5,stroke:#9e9e9e
    style DockerDesktop fill:#e3f2fd,stroke:#1976D2
```

---

## 16. Class Diagram (Backend Models)

```mermaid
classDiagram
    class User {
        +int id
        +string email
        +string slug
        +string first_name
        +string last_name
        +string bio
        +string location
        +ManyToMany saved_startups
        +ManyToMany followed_startups
        +string name
        +string initials
        +save()
    }

    class Startup {
        +string slug
        +string name
        +string initials
        +bool verified
        +User owner
        +string tagline
        +string status
        +list tags
        +int goal
        +int raised
        +string deadline
        +text overview
        +int funding_pct
        +save()
    }

    class CollaborationRole {
        +int id
        +Startup startup
        +string role
        +text body
    }

    class TeamMember {
        +int id
        +Startup startup
        +string name
        +string title
        +int order
    }

    class TimelineEvent {
        +int id
        +Startup startup
        +string date_label
        +string title
        +text description
        +int order
    }

    class Document {
        +int id
        +Startup startup
        +string name
        +string size
        +FileField file
        +int order
    }

    class UpdateEntry {
        +int id
        +Startup startup
        +string text
        +datetime created_at
    }

    class StartupComment {
        +int id
        +Startup startup
        +User author
        +text text
        +datetime created_at
    }

    class Application {
        +int id
        +Startup startup
        +User applicant
        +string role
        +string name
        +string email
        +string link
        +text message
        +string status
        +datetime created_at
    }

    class Investment {
        +int id
        +Startup startup
        +User investor
        +int amount
        +string status
        +datetime created_at
    }

    class Post {
        +int id
        +Startup startup
        +User author
        +string kind
        +string post_type
        +string title
        +text text
        +list tags
        +string media
        +datetime created_at
    }

    class Conversation {
        +int id
        +Startup startup
        +User initiator
        +datetime created_at
    }

    class Message {
        +int id
        +Conversation conversation
        +User sender
        +text text
        +bool read
        +datetime created_at
    }

    class Notification {
        +int id
        +User recipient
        +string icon
        +string color
        +string text
        +string link
        +bool read
        +datetime created_at
    }

    User "1" --> "0..*" Startup            : owns
    User "0..*" --> "0..*" Startup         : saves and follows
    Startup "1" --> "0..1" CollaborationRole : has
    Startup "1" --> "0..*" TeamMember      : has
    Startup "1" --> "0..*" TimelineEvent   : has
    Startup "1" --> "0..*" Document        : has
    Startup "1" --> "0..*" UpdateEntry     : has
    Startup "1" --> "0..*" StartupComment  : receives
    User "1" --> "0..*" StartupComment     : writes
    Startup "1" --> "0..*" Application     : receives
    User "1" --> "0..*" Application        : submits
    Startup "1" --> "0..*" Investment      : receives
    User "1" --> "0..*" Investment         : makes
    Startup "1" --> "0..*" Post            : posts
    User "1" --> "0..*" Post               : creates
    Startup "1" --> "0..*" Conversation    : has
    User "1" --> "0..*" Conversation       : initiates
    Conversation "1" --> "0..*" Message    : contains
    User "1" --> "0..*" Message            : sends
    User "1" --> "0..*" Notification       : receives
```

---

*Generated from source analysis of backend models, views, serializers, URLs and src React components and context.*
