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
    resumeUrl: "",
    // Initials shown in the nav logo.
    initials: "GK",
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
      title: "Real-time Multiplayer Battleship",
      org: "Carnegie Mellon University",
      url: "",
      description:
        "A real-time multiplayer game with a JavaScript/HTML front-end and a Python (Django) backend using WebSockets. Features user registration, login, matchmaking, and in-game chat, supporting multiple concurrent matches. Deployed on Amazon EC2 with SSL.",
      tags: ["Django", "WebSocket", "JavaScript", "AWS EC2"],
    },
    {
      title: "Rama IV Traffic Dashboard & Prediction",
      org: "Chulalongkorn University",
      url: "",
      description:
        "A traffic monitoring dashboard and speed-prediction system built on taxi GPS data. Dashboard in Plotly Dash backed by Google BigQuery; a CNN-based model treats traffic as images (time-space matrices) to predict speed within ~10 km/h. Served via Flask in Docker on Google Cloud Run.",
      tags: ["Plotly Dash", "BigQuery", "CNN", "Flask", "Cloud Run"],
    },
    {
      title: "Namo Dhamma Chat Bot",
      org: "Chulalongkorn University",
      url: "",
      description:
        "A LINE chatbot delivering Dhamma guidance to support individuals with depression and promote mindfulness. Built with Dialogflow (NLU), Cloud Scheduler, Cloud Datastore, and Cloud Storage; containerized with Docker and deployed on Google Cloud Run.",
      tags: ["Dialogflow", "LINE", "GCP", "Docker"],
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
      degree: "Master of Software Engineering",
      location: "Pittsburgh, PA, USA",
      period: "Aug 2023 – Dec 2024",
      detail: "GPA 4.05 · Cloud Computing, DevOps & Security, Web Applications, Software Architectures, Quality Assurance, Agile Methods, Project Management.",
    },
    {
      school: "Chulalongkorn University",
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
    { id: "certifications", label: "Certifications" },
    { id: "education", label: "Education" },
    { id: "awards", label: "Awards" },
    { id: "contact", label: "Contact" },
  ],
};
