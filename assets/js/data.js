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
    role: "Cloud & Software Architect",
    // Longer headline (kept in sync with LinkedIn).
    headline:
      "Cloud & Software Architect · Software Engineer · Azure Expert · Carnegie Mellon MSE · Ex-Agoda · Bank of Thailand Scholar",
    location: "Bangkok, Thailand",
    // Used for the <title> and SEO description.
    seoDescription:
      "Gun Kaewngarm — Cloud & Software Architect at the Bank of Thailand. Carnegie Mellon Master of Software Engineering, ex-Agoda. Building scalable, enterprise-grade systems.",
    // Path/URL to the resume PDF you want to expose (optional). Leave "" to hide.
    // NOTE: this is your older one-page résumé — replace the file at
    // assets/Gun_Kaewngarm_Resume.pdf whenever you have an updated version.
    resumeUrl: "assets/Gun_Kaewngarm_Resume.pdf",
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
    phone: "+66 97 038 5655",
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
      { value: "4.05", label: "CMU MSE GPA" },
      { value: "6+", label: "years building software" },
    ],
  },

  /* ----------------------------------------------------------------------- */
  /*  EXPERIENCE  (most recent first)                                        */
  /* ----------------------------------------------------------------------- */
  experience: [
    {
      company: "Bank of Thailand",
      logo: "bot.or.th",
      role: "Software Architect",
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
      logo: "adrich.io",
      role: "Lead Software Engineer",
      location: "Pittsburgh, PA, USA",
      note: "In partnership with Carnegie Mellon University",
      start: "Jan 2024",
      end: "Dec 2024",
      bullets: [
        "Led the architecture redesign of Adrich's backend to scale IoT Smart Labels from 20,000 to 5 million devices using Node.js (Express) and Python (FastAPI).",
        "Developed a data transfer protocol for smart labels — implementing ECL compression in C on-device with caching and decompression on the Node.js backend — cutting transfer latency and reducing payload size by 50%.",
        "Designed and implemented a calibration dashboard in React to streamline IoT Smart Label device setup.",
        "Designed and implemented CI/CD pipelines using GitLab CI, deploying solutions on Digital Ocean.",
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
  /*  PROJECTS                                                               */
  /* ----------------------------------------------------------------------- */
  projects: [
    {
      title: "GunVest",
      org: "Investment Dashboard · Full-stack",
      url: "https://github.com/givewgun/gunvest-public",
      description:
        "A real-time investment command center with macro tracking, behavioral coaching, and AI-powered sentiment analysis that aggregates Finnhub, StockTwits, Reddit, and Google Gemini. Includes a geopolitical \"war room\" (GDELT + RSS ingestion with AI impact scoring) and an Inverse-Cramer module that extracts Cramer's picks via YouTube + Gemini for contrarian signals.",
      tags: ["React 18", "Node.js / Express", "Socket.io", "Gemini AI", "SQLite", "Docker"],
    },
    {
      title: "Horizon",
      org: "Space & Earth Dashboard",
      url: "https://github.com/givewgun/horizon",
      description:
        "A real-time space & earth monitoring dashboard: launch forecasts with countdowns and embedded webcasts (The Space Devs API), a CesiumJS satellite globe tracking the ISS, Hubble & JWST with client-side SGP4 orbit propagation and visible-pass prediction, and aggregated NASA/SpaceX/ESA live streams. Containerized behind a Cloudflare Tunnel.",
      tags: ["TypeScript", "React + Vite", "Fastify", "CesiumJS", "Docker", "Cloudflare Tunnel"],
    },
    {
      title: "MangaDL",
      org: "Desktop App · Electron",
      url: "https://github.com/givewgun/manga-dl",
      description:
        "A cross-platform Electron desktop app to browse, read, and download manga from multiple sources through a pluggable adapter system (native MangaDex API plus manifest-based and adaptive HTML probing). Resilient bulk downloads with pause/resume, exponential-backoff retries, crash recovery, and automated CBZ library management.",
      tags: ["TypeScript", "Electron", "React", "Vite", "SQLite"],
    },
    {
      title: "elscione-dl",
      org: "Python · Interactive TUI",
      url: "https://github.com/givewgun/elscione-dl",
      description:
        "A bulk light-novel & manga downloader with a full-screen interactive terminal UI and automatic OneDrive sync. Smart resume via .part files and manifest tracking, EPUB/PDF export, and configurable parallel downloads (1–10 concurrent) with automatic retry logic for failed files.",
      tags: ["Python 3.11", "TUI", "TOML", "Async"],
    },
    {
      title: "Jenkins DevOps Pipeline",
      org: "CI/CD · Infrastructure",
      url: "https://github.com/givewgun/jenkins-full-devops-pipeline",
      description:
        "An end-to-end CI/CD pipeline integrating build, code-quality, security, and deployment stages — Jenkins orchestration with SonarQube quality gates, OWASP ZAP security scanning, Ansible-driven EC2 deployment, and a Prometheus + Grafana observability stack.",
      tags: ["Jenkins", "SonarQube", "OWASP ZAP", "Ansible", "Prometheus", "Grafana"],
    },
    {
      title: "FlappyAI",
      org: "Machine Learning",
      url: "https://github.com/givewgun/FlappyAI",
      description:
        "An AI that learns to play Flappy Bird autonomously by combining neural networks with a genetic algorithm — evolving and optimizing bird behavior across generations, with model persistence to track training progress.",
      tags: ["Python", "Neural Networks", "Genetic Algorithm"],
    },
    {
      title: "Rama IV Traffic Dashboard & Prediction",
      org: "Data Engineering · ML",
      url: "https://github.com/givewgun/RamaIV-Dashboard-prediction",
      description:
        "A traffic monitoring dashboard and speed-prediction system built on taxi GPS data (Chulalongkorn University). The dashboard runs on Plotly Dash backed by Google BigQuery; a CNN-based model treats traffic as images — translating spatiotemporal dynamics into time-space matrices — to predict speed within ~10 km/h. Served via Flask in Docker on Google Cloud Run.",
      tags: ["Python", "CNN / Deep Learning", "Plotly Dash", "BigQuery", "Flask", "Cloud Run"],
    },
    {
      title: "Real-time Multiplayer Battleship",
      org: "Real-time Multiplayer Game",
      url: "https://github.com/givewgun/battleducks",
      description:
        "A real-time, two-player Battleship game (Carnegie Mellon University) with a JavaScript/HTML front-end and a Python (Django) backend over WebSockets. Features OAuth login, matchmaking, and in-game chat, backed by PostgreSQL and supporting multiple concurrent matches. Deployed on Amazon EC2 with SSL.",
      tags: ["Django", "WebSocket", "PostgreSQL", "OAuth", "AWS EC2"],
    },
  ],

  /* ----------------------------------------------------------------------- */
  /*  CERTIFICATIONS                                                         */
  /* ----------------------------------------------------------------------- */
  certifications: [
    { name: "Microsoft Certified: Azure Solutions Architect Expert", issuer: "Microsoft" },
    { name: "Kubernetes Mastery", issuer: "" },
    { name: "GitLab CI: Pipelines, CI/CD and DevOps", issuer: "" },
    { name: "Pragmatic System Design", issuer: "" },
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
      detail: "GPA 4.05 · Cloud Computing, DevOps & Security, Web Applications, Software Architectures, Quality Assurance, Agile Methods, Project Management.",
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
  /*  SECTION ORDER & LABELS                                                 */
  /*  Reorder this array to reorder the page. Remove a line to hide a        */
  /*  section from both the nav and the page.                               */
  /* ----------------------------------------------------------------------- */
  sectionOrder: [
    { id: "about", label: "About" },
    { id: "experience", label: "Experience" },
    { id: "skills", label: "Skills" },
    { id: "projects", label: "Projects" },
    { id: "repos", label: "Open Source" },
    { id: "certifications", label: "Certifications" },
    { id: "education", label: "Education" },
    { id: "awards", label: "Awards" },
    { id: "contact", label: "Contact" },
  ],
};
