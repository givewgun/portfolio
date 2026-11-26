/*
 * ============================================================================
 *  PORTFOLIO CONTENT  —  EDIT THIS FILE TO UPDATE YOUR SITE
 * ============================================================================
 *  Everything shown on the website is driven by the `portfolioData` object
 *  below. You do NOT need to touch any HTML/CSS to change the content.
 *
 *  - Add/remove/reorder items inside any array and the page updates itself.
 *  - Leave a field as "" or [] to hide it.
 *  - Each "section" can be reordered via the `sectionOrder` array at the end.
 * ============================================================================
 */

const portfolioData = {
  /* ----------------------------------------------------------------------- */
  /*  BASIC INFO                                                             */
  /* ----------------------------------------------------------------------- */
  meta: {
    name: "Gun Kaewngarm",
    // Short tagline used in the hero + browser title.
    role: "Senior Software Architect",
    // One-line pitch shown under the name in the hero.
    tagline:
      "I architect identity, cloud and distributed systems that serve millions — and I still ship the code myself.",
    // Longer headline (kept in sync with LinkedIn).
    headline:
      "Cloud & Software Architect · Software Engineer · Azure Expert · Carnegie Mellon MSE · Ex-Agoda · Bank of Thailand Scholar",
    location: "Bangkok, Thailand",
    // Credential line under the hero pitch.
    creds: ["Bank of Thailand", "Carnegie Mellon MSE", "Ex-Agoda", "Azure Solutions Architect Expert"],
    // Shown in the hero telemetry line (decimal degrees, local timezone).
    coords: { lat: 13.7563, lon: 100.5018, tz: "Asia/Bangkok", tzLabel: "ICT" },
    // Used for the <title> and SEO description.
    seoDescription:
      "Gun Kaewngarm — Senior Software Architect at the Bank of Thailand. Carnegie Mellon MSE, ex-Agoda. Creator of tandem, the open-source Claude Code + Gemini team tool.",
    // The résumé is generated on the fly from this data by assets/js/resume.js
    // when the visitor clicks the "Résumé (PDF)" button — no static file needed.
    // Initials shown in the nav logo.
    initials: "GK",
    // GitHub username — used by the live "Featured Repositories" section.
    githubUser: "givewgun",
    // Live repos section settings.
    // - Forks and archived repos are always hidden.
    // - Repo names matching any of these patterns are also hidden (tutorials,
    //   coursework, this site, the profile README, etc.). Edit as needed.
    githubExcludePatterns: [
      "tutorial", "study", "recitation", "assignment", "bootcamp",
      "boot-camp", "essential", "portfolio", "givewgun",
      "elscione-dl", "flappyai", "battleducks", "ramaiv",
    ],
    // Max number of repos to show in the live section.
    githubRepoLimit: 6,
  },

  /* ----------------------------------------------------------------------- */
  /*  CONTACT / SOCIAL LINKS                                                 */
  /*  `icon` matches a key in the icon set inside main.js                    */
  /* ----------------------------------------------------------------------- */
  contact: {
    email: "gun.kaewngarm@gmail.com",
    phone: "",
    links: [
      {
        label: "LinkedIn",
        icon: "linkedin",
        url: "https://www.linkedin.com/in/gun-kaewngarm",
      },
      {
        label: "GitHub",
        icon: "github",
        url: "https://github.com/givewgun",
      },
      {
        label: "Email",
        icon: "mail",
        url: "mailto:gun.kaewngarm@gmail.com",
      },
    ],
  },

  /* ----------------------------------------------------------------------- */
  /*  ABOUT / SUMMARY                                                        */
  /* ----------------------------------------------------------------------- */
  about: {
    // Each string is a paragraph.
    paragraphs: [
      "I'm a Software & Enterprise Architect at the Bank of Thailand, where I design and deliver enterprise-scale systems that drive innovation and reliability. My work spans identity & access management serving millions of users, DevOps transformation, cloud adoption, and architecture governance.",
      "Beyond architecture, I keep my hands on the keyboard — making sure solutions stay practical, efficient, and maintainable across both professional and personal projects. I hold a Master of Software Engineering from Carnegie Mellon University, fully funded through a Bank of Thailand scholarship.",
      "Previously, I built scalable, high-performance systems at Agoda — one of Thailand's top tech companies — and led an IoT backend redesign at Adrich (in partnership with CMU) that scaled from 20,000 to 5 million devices.",
    ],
    // Quick stat highlights shown as cards.
    highlights: [
      { value: "5M+", label: "IoT devices scaled to" },
      { value: "2M+", label: "users served by IAM platform" },
      { value: "4.11", label: "CMU MSE GPA" },
      { value: "6+", label: "years building software" },
    ],
  },

  /* ----------------------------------------------------------------------- */
  /*  EXPERIENCE  (most recent first)                                        */
  /* ----------------------------------------------------------------------- */
  experience: [
    {
      company: "Bank of Thailand",
      logo: "https://commons.wikimedia.org/wiki/Special:FilePath/Seal_of_the_Bank_of_Thailand.png?width=256",
      role: "Senior Software Architect",
      location: "Bangkok, Thailand",
      start: "Jan 2025",
      end: "Present",
      current: true,
      bullets: [
        "Designed and implemented the Bank of Thailand's public Identity & Access Management service (iam.bot.or.th) using .NET 10, Docker, SQL Server, and Azure AD B2C — serving 2M+ users with unified authentication across BOT's digital and internal enterprise applications.",
        "Led DevOps transformation initiatives including CI/CD pipeline standardization and infrastructure automation across development teams.",
        "Led architecture evaluation and advisory for enterprise Identity Governance & Administration (IGA), covering identity lifecycle management for public and institutional users.",
        "Drove adoption of AI-assisted development tooling (Microsoft Copilot, GitHub Copilot) across engineering teams, defining governance standards and usage guidelines.",
        "Established golden container image standardization — centralized, versioned base images that enforce security baselines and reduce configuration drift across environments.",
        "Defined architecture standards, ARB governance frameworks, and review procedures; consulted on Azure adoption, IAM design, and zero-trust principles across internal teams.",
      ],
      tags: [".NET 10", "Azure AD B2C", "Docker", "SQL Server", "Zero Trust", "Enterprise Architecture"],
    },
    {
      company: "Adrich, LLC",
      logo: "https://static.wixstatic.com/media/f78c1d_929cd1f98357470ea6c2f1dbd98a57c9~mv2.png/v1/crop/x_8,y_0,w_712,h_169/fill/w_506,h_120,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Adrich_Logo_dtewdf.png",
      role: "Lead Software Engineer",
      location: "Pittsburgh, PA, USA",
      note: "In partnership with Carnegie Mellon University",
      start: "Jan 2024",
      end: "Dec 2024",
      bullets: [
        "Directed the architectural redesign of an enterprise IoT backend, successfully scaling system capacity from 20,000 to 5 million concurrent Smart Label devices utilizing Node.js (Express) and Python (FastAPI).",
        "Formalized the system design process by authoring comprehensive Architecture Design Records (ADRs) to document technical trade-offs, define system revisions, and align stakeholders on the scaling strategy.",
        "Architected an API Gateway and message queue layer in front of the existing legacy backend, decoupling services to dramatically improve system throughput, request routing, and fault tolerance under high-volume IoT traffic.",
        "Engineered a low-latency data transfer protocol for resource-constrained devices, implementing ECL compression in C on-device with backend caching and decompression, slashing payload sizes by 50%.",
        "Developed a custom middleware simulator to replicate high-concurrency smart label data, enabling rigorous load testing and validation of the revised architecture prior to production deployment.",
        "Streamlined device provisioning by designing and deploying a React-based calibration dashboard to accelerate IoT Smart Label setup.",
        "Modernized deployment infrastructure by establishing automated CI/CD workflows via GitLab CI and GitHub Actions, ensuring highly reliable, zero-downtime deployments on Digital Ocean."
      ],
      tags: ["Node.js", "FastAPI", "C", "React", "GitLab CI", "IoT"],
    },
    {
      company: "Agoda",
      logo: "agoda.com",
      role: "Software Engineer",
      location: "Bangkok, Thailand",
      start: "Jun 2021",
      end: "Jun 2023",
      bullets: [
        "Designed, developed, and maintained data-intensive customer communication microservices (email, SMS, push) using Scala, Akka, MS-SQL, Kafka, Grafana, Hadoop, Docker, and Kubernetes.",
        "Led the project to containerize services with Docker, shell scripting, and Helm for deployment on the company's experimental Kubernetes clusters — minimizing developer testing and deployment time.",
        "Designed and built the Campaign Engine to create, schedule, and execute marketing campaigns targeting multiple audiences by querying SQL and Hadoop data sources.",
        "Built an HTML Template Engine for email/push/SMS templates sent via the Campaign Engine, powering revenue-generating marketing campaigns.",
        "Designed data logging & tracking pipelines to analyze customer behavior and tailor campaigns to booker behavior.",
        "Used Spark to identify users for retargeting reminder emails, driving additional booking revenue.",
      ],
      tags: ["Scala", "Akka", "Kafka", "Spark", "Hadoop", "Kubernetes", "Microservices"],
    },
    {
      company: "Agoda",
      logo: "agoda.com",
      role: "Associate Software Engineer",
      location: "Bangkok, Thailand",
      start: "Jun 2020",
      end: "May 2021",
      bullets: [
        "Developed and maintained the customer communication system (email, SMS, push notifications) using Scala, Kafka, and Akka.",
        "Containerized services with Docker and shell scripting for deployment on experimental Kubernetes clusters.",
        "Maintained the team's CI/CD pipeline using TeamCity.",
      ],
      tags: ["Scala", "Kafka", "Akka", "Docker", "TeamCity"],
    },
    {
      company: "Demeter ICT",
      logo: "demeterict.com",
      role: "Back End Developer & Tester (Intern)",
      location: "Bangkok, Thailand",
      start: "Jun 2019",
      end: "Jul 2019",
      bullets: [
        "Developed embedded JavaScript applications on the Zendesk platform for customer service agents.",
        "Tested and optimized Android applications and developed new backend functions for a sales website.",
      ],
      tags: ["JavaScript", "Java", "Android", "Zendesk"],
    },
  ],

  /* ----------------------------------------------------------------------- */
  /*  SKILLS  (grouped)                                                      */
  /* ----------------------------------------------------------------------- */
  skills: [
    {
      group: "Languages",
      items: ["C#/.NET", "Scala", "Java", "Python", "JavaScript / TypeScript", "C", "SQL (T-SQL, MySQL, SparkSQL)"],
    },
    {
      group: "Frameworks & Runtimes",
      items: [".NET", "Node.js (Express)", "FastAPI", "Flask", "Akka", "Spring", "React", "Django"],
    },
    {
      group: "Cloud Platforms",
      items: ["Microsoft Azure", "Amazon Web Services (AWS)", "Google Cloud Platform (GCP)", "Digital Ocean"],
    },
    {
      group: "DevOps & Infrastructure",
      items: ["Docker", "Kubernetes", "Helm", "GitLab CI", "Jenkins", "TeamCity", "Consul", "Vault", "Shell Scripting", "Linux"],
    },
    {
      group: "Data & Messaging",
      items: ["Kafka", "Spark", "Hadoop", "Hive", "Impala", "BigQuery", "Grafana"],
    },
    {
      group: "Architecture & Practice",
      items: ["Enterprise Architecture", "Zero Trust", "Identity & Access Management", "CI/CD", "Microservices", "Agile"],
    },
  ],

  /* ----------------------------------------------------------------------- */
  /*  LATEST LAUNCH SPOTLIGHT  (the "tandem" section)                        */
  /*  `coverage` items render as chips; add a `url` to make one a link       */
  /*  (e.g. paste the Reddit permalink of a launch post).                    */
  /* ----------------------------------------------------------------------- */
  launch: {
    name: "tandem",
    // Fallback version; the live one is fetched from npm at runtime.
    version: "0.5.0",
    when: "Nov 2026",
    title: "Claude Code + Gemini, flying as one team.",
    pitch:
      "tandem is an open-source CLI and MCP bridge that pairs Claude Code with Google Antigravity (Gemini) on the subscriptions you already pay for. No API keys, no runtime dependencies. Either agent can lead, and reviews always go to the other model family — a fresh context with different priors catches what the author misses.",
    points: [
      { value: "5", label: "real release bugs caught by a cold cross-model review — incl. a DNS-rebinding hole in the local dashboard" },
      { value: "0", label: "API keys and 0 runtime dependencies — drives the headless CLIs you already sign into" },
      { value: "5h", label: "and weekly plan windows read live from both plans; work is routed around limits automatically" },
    ],
    meta: "Built with itself — and this site was redesigned by the same Claude + Gemini pair.",
    install: "npm install -g tandem-agents",
    repo: "givewgun/multi-agents-pc",
    npm: "tandem-agents",
    image: "assets/img/tandem-dashboard.png",
    imageAlt: "tandem's local dashboard: work split between Claude and Gemini, 5-hour and weekly plan meters, and live limit routing",
    links: [
      { label: "GitHub", icon: "github", url: "https://github.com/givewgun/multi-agents-pc" },
      { label: "Architecture (15 ADRs)", icon: "book", url: "architecture.html#tandem", local: true },
      { label: "npm", icon: "package", url: "https://www.npmjs.com/package/tandem-agents" },
      { label: "60-second ELI5", icon: "book", url: "https://github.com/givewgun/multi-agents-pc/blob/main/docs/ELI5.md" },
    ],
    coverage: [
      { label: "Launched on Reddit", url: "" },
      { label: "Published to npm", url: "https://www.npmjs.com/package/tandem-agents" },
      { label: "MIT open source", url: "https://github.com/givewgun/multi-agents-pc/blob/main/LICENSE" },
    ],
  },

  /* ----------------------------------------------------------------------- */
  /*  PROJECTS  (curated top systems; tandem lives in the Launch Spotlight)  */
  /* ----------------------------------------------------------------------- */
  projects: [
    {
      title: "Legion",
      org: "Multi-Agent Consensus Engine · 36 ADRs",
      url: "https://github.com/givewgun/legion",
      archUrl: "architecture.html#legion",
      archLabel: "Architecture & 36 ADRs",
      featured: true,
      description:
        "A leaderless multi-agent stock-signal engine over NATS with no prime decider: 4 LLM voters plus a deterministic risk node debate dissent across rounds and converge via BFT-flavored weighted aggregation, Pearson redundancy-discounted quorum, anti-herding guards, crash-recoverable state replay, and an outbox-decoupled paper execution pipeline.",
      tags: ["Node.js", "NATS", "Ollama", "PostgreSQL", "OpenTelemetry", "Docker"],
    },
    {
      title: "Oculory",
      org: "Three-Pillar Observability Platform · Self-hosted",
      url: "https://github.com/givewgun/oculory",
      archUrl: "architecture.html#oculory",
      archLabel: "Architecture & 3-Pillar Stack",
      description:
        "A unified Grafana observability platform on an Oracle Always-Free ARM64 VM: Prometheus metrics (with RED exemplars), Loki structured logs, and Tempo distributed traces collected by a single Grafana Alloy agent with tail-sampling, custom Docker API metrics, NATS W3C traceparent stitching, and zero-trust ingress via Cloudflare Tunnel & Access.",
      tags: ["Grafana", "Prometheus", "Loki", "Tempo", "Alloy", "Alertmanager", "Docker"],
    },
    {
      title: "Horizon",
      org: "Resilient Space & Earth Telemetry · 6 ADRs",
      url: "https://github.com/givewgun/horizon",
      archUrl: "architecture.html#horizon",
      archLabel: "Architecture & 6 ADRs",
      description:
        "A real-time space & earth monitoring platform aggregating 7+ volatile third-party feeds behind a single-process Fastify proxy with single-flight TTL caching, last-known-good stale fallback, honest freshness badges, client-side SGP4 orbit propagation on lazy-loaded CesiumJS, and a custom Canvas stereographic planetarium.",
      tags: ["TypeScript", "React + Vite", "Fastify", "CesiumJS", "SQLite", "Cloudflare Tunnel"],
    },
    {
      title: "GunVest",
      org: "Investment Command Center · 10 ADRs",
      url: "https://github.com/givewgun/gunvest-public",
      archUrl: "https://github.com/givewgun/gunvest-public/blob/main/docs/ARCHITECTURE.md",
      archLabel: "Architecture & 10 ADRs",
      archExternal: true,
      description:
        "A full-stack investment command center with macro tracking, behavioral coaching, and AI sentiment aggregation across Finnhub, StockTwits, Reddit, and Google Gemini — backed by PostgreSQL, Socket.io real-time updates, and a GDELT + RSS geopolitical impact ingestion pipeline.",
      tags: ["React 18", "Node.js / Express", "PostgreSQL", "Socket.io", "Gemini AI", "Docker"],
    },
  ],

  /* ----------------------------------------------------------------------- */
  /*  CERTIFICATIONS                                                         */
  /* ----------------------------------------------------------------------- */
  certifications: [
    { name: "Microsoft Certified: Azure Solutions Architect Expert", issuer: "Microsoft" },
  ],

  /* ----------------------------------------------------------------------- */
  /*  EDUCATION                                                              */
  /* ----------------------------------------------------------------------- */
  education: [
    {
      school: "Carnegie Mellon University",
      logo: "cmu.edu",
      degree: "Master of Software Engineering",
      location: "Pittsburgh, PA, USA",
      period: "Aug 2023 – Dec 2024",
      detail: "GPA 4.11 · Cloud Computing, DevOps & Security, Web Applications, Software Architectures, Quality Assurance, Agile Methods, Project Management.",
    },
    {
      school: "Chulalongkorn University",
      logo: "chula.ac.th",
      degree: "Bachelor of Engineering, Computer Engineering",
      location: "Bangkok, Thailand",
      period: "2016 – 2020",
      detail: "GPA 3.65 · Data Structures, Algorithm Design, System Analysis & Design, Software Engineering, Cloud Computing, Data Science & Engineering, Computer Security.",
    },
  ],

  /* ----------------------------------------------------------------------- */
  /*  HONORS & AWARDS                                                        */
  /* ----------------------------------------------------------------------- */
  awards: [
    {
      name: "Bank of Thailand Scholarship",
      issuer: "Bank of Thailand",
      date: "Sep 2022",
      detail: "Full-ride scholarship awarded to pursue a master's degree in software engineering abroad — selected from applicants across Thailand.",
    },
  ],

  /* ----------------------------------------------------------------------- */
  /*  LANGUAGES                                                              */
  /* ----------------------------------------------------------------------- */
  languages: [
    { name: "Thai", level: "Native / Bilingual" },
    { name: "English", level: "Full Professional" },
  ],

  /* ----------------------------------------------------------------------- */
  /*  FLIGHT PROFILE  (launch.html — the career told as a rocket launch)     */
  /*  `t` = mission elapsed time in seconds. Events render in `t` order and  */
  /*  each gets an equal slice of the scroll. `vehicle: "booster"` events    */
  /*  play in the booster-cam picture-in-picture after stage separation.     */
  /*  `link` (optional) adds a button to the event card.                     */
  /* ----------------------------------------------------------------------- */
  flight: {
    mission: "GK-1",
    vehicle: "Career Launch Vehicle",
    site: "LC-13 · Bangkok, Thailand",
    events: [
      {
        t: 0, code: "LIFTOFF", title: "Chulalongkorn University",
        sub: "B.Eng. Computer Engineering · 2016 – 2020",
        body: "Liftoff from Bangkok. Data structures, algorithm design, distributed systems and cloud computing — graduated with a 3.65 GPA and a CNN that predicts Rama IV traffic speed from taxi GPS.",
        stats: [{ v: "3.65", l: "GPA" }],
      },
      {
        t: 14, code: "TOWER CLEAR", title: "Demeter ICT",
        sub: "Back End Developer & Tester (Intern) · 2019",
        body: "Cleared the tower: first production code — embedded JavaScript apps on Zendesk for support agents, Android testing and new backend functions for a sales site.",
      },
      {
        t: 58, code: "MACH 1", title: "Agoda",
        sub: "Associate Software Engineer · 2020",
        body: "Supersonic. Production Scala, Kafka and Akka on the customer-communication platform (email, SMS, push) at one of Thailand's top tech companies.",
      },
      {
        t: 74, code: "MAX-Q", title: "Agoda",
        sub: "Software Engineer · 2021 – 2023",
        body: "Peak pressure: data-intensive microservices, a Campaign Engine querying SQL and Hadoop, an HTML template engine for revenue campaigns, Spark retargeting and Kubernetes migration.",
        stats: [{ v: "Kafka", l: "Akka · Spark" }],
      },
      {
        t: 150, code: "MECO", title: "Bank of Thailand Scholarship",
        sub: "Full-ride master's scholarship · Sep 2022",
        body: "Main engine cut-off. Selected from applicants across Thailand for a fully funded master's in software engineering abroad.",
      },
      {
        t: 154, code: "STAGE SEP", title: "Separation",
        sub: "Agoda → Pittsburgh · Jun 2023",
        body: "Stage one peels away and turns for home. It will be back — that's the point of a reusable booster.",
      },
      {
        t: 162, code: "SES-1", title: "Carnegie Mellon University",
        sub: "Master of Software Engineering · 2023 – 2024",
        body: "Second engine start. Cloud computing, DevOps & security, software architecture and quality assurance — finished with a 4.11 GPA.",
        stats: [{ v: "4.11", l: "CMU GPA" }],
      },
      {
        t: 172, code: "BOOSTBACK", vehicle: "booster", title: "Booster · boostback burn",
        sub: "Flip and head for Bangkok",
        body: "The booster flips and burns back toward the launch site, carrying everything learned on the way up.",
      },
      {
        t: 228, code: "FAIRING SEP", title: "Adrich, LLC",
        sub: "Lead Software Engineer · 2024 · with CMU",
        body: "Fairings off, payload exposed to real load. Re-architected an IoT backend from 20,000 to 5 million concurrent Smart Label devices: ADRs, an API gateway and queue layer, and on-device ECL compression that halved payloads.",
        stats: [{ v: "5M", l: "devices" }, { v: "−50%", l: "payload" }],
      },
      {
        t: 362, code: "ENTRY BURN", vehicle: "booster", title: "Booster · entry burn",
        sub: "Re-entering the atmosphere",
        body: "Three engines relight to slow the descent through the thickening air. Grid fins steer.",
      },
      {
        t: 404, code: "LANDING BURN", vehicle: "booster", title: "Booster · landing burn",
        sub: "One engine, final approach",
        body: "A single engine brings it down onto the tower, metres per second at a time.",
      },
      {
        t: 418, code: "CATCH", vehicle: "booster", title: "Home — Bank of Thailand",
        sub: "Caught by the tower · Jan 2025",
        body: "The booster is home. Back in Bangkok and back at the Bank of Thailand, ready to fly again.",
      },
      {
        t: 512, code: "SECO", title: "Bank of Thailand",
        sub: "Senior Software Architect · 2025 – present",
        body: "Orbit. Designed the public Identity & Access Management service (iam.bot.or.th) on .NET 10 and Azure AD B2C, led the DevOps transformation, golden container images, ARB governance and zero-trust advisory.",
        stats: [{ v: "2M+", l: "IAM users" }],
      },
      {
        t: 566, code: "PAYLOAD DEPLOY", title: "tandem",
        sub: "Open source · npm tandem-agents · Nov 2026",
        body: "Primary payload away: Claude Code and Gemini flying as one team on the plans you already pay for. Zero API keys, zero runtime dependencies, and cross-model reviews that caught five real release bugs.",
        link: { label: "See tandem", url: "index.html#tandem" },
      },
      {
        t: 610, code: "RIDESHARE", title: "Rideshare deployment",
        sub: "Legion · GunVest · Horizon · Oculory",
        body: "Smaller payloads spring off the adapter: a leaderless multi-agent signal engine, an investment command center, a space & earth dashboard, and a zero-cost observability stack.",
        link: { label: "All projects", url: "index.html#projects" },
      },
      {
        t: 640, code: "NOMINAL ORBIT", title: "Mission success",
        sub: "Next mission: yours?",
        body: "All vehicles nominal. If you're building something ambitious — identity, cloud, distributed systems or AI tooling — let's talk.",
        link: { label: "Open a channel", url: "index.html#contact" },
      },
    ],
  },

  /* ----------------------------------------------------------------------- */
  /*  SECTION ORDER & LABELS                                                 */
  /*  Reorder this array to reorder the page. Remove a line to hide a        */
  /*  section from both the nav and the page.                               */
  /* ----------------------------------------------------------------------- */
  //  `nav: false` keeps a section on the page but out of the navbar (it is
  //  still reachable from the ⌘K command palette).
  sectionOrder: [
    { id: "about", label: "About" },
    { id: "tandem", label: "Launch" },
    { id: "experience", label: "Experience" },
    { id: "skills", label: "Skills", nav: false },
    { id: "projects", label: "Projects" },
    { id: "repos", label: "Open Source", nav: false },
    { id: "certifications", label: "Certifications", nav: false },
    { id: "education", label: "Education" },
    { id: "awards", label: "Awards", nav: false },
    { id: "contact", label: "Contact" },
  ],

  /* ----------------------------------------------------------------------- */
  /*  ARCANE THEME LABELS (D&D / BG3 flavor)                                 */
  /*  Used ONLY while the opt-in "Arcane" theme is active. Keyed by section  */
  /*  id; each may set `nav` (navbar text), `kicker`, and/or `title`.        */
  /*  Edit freely — the professional themes always use the standard labels.  */
  /* ----------------------------------------------------------------------- */
  arcaneLabels: {
    about:          { nav: "Lore",          kicker: "Origin story",        title: "Lore" },
    tandem:         { nav: "Familiars",     kicker: "A newly bound pact",  title: "The Twin Familiars" },
    experience:     { nav: "Campaign",      kicker: "The journey so far",  title: "Campaign Log" },
    skills:         { nav: "Proficiencies", kicker: "Abilities & feats",   title: "Proficiencies" },
    projects:       { nav: "Quests",        kicker: "Completed quests",    title: "Quests" },
    repos:          { nav: "Artifacts",     kicker: "From the workshop",   title: "Artifacts & Relics" },
    certifications: { nav: "Attunements",   kicker: "Credentials",         title: "Attunements" },
    education:      { nav: "Training",      kicker: "Where I trained",     title: "Training Grounds" },
    awards:         { nav: "Honors",        kicker: "Recognition",         title: "Honors & Tongues" },
    contact:        { nav: "Parley",        kicker: "Send a raven",        title: "Parley" },
  },
};

// Expose for other modules (main.js, resume.js) and any external tooling.
if (typeof window !== "undefined") window.portfolioData = portfolioData;
