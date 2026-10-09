import { Section, SectionHeading } from "./Section";

const JOBS = [
  {
    role: "Software Development Engineer Intern",
    company: "Bluestock Fintech",
    location: "Remote",
    dates: "Jan 2026 – Feb 2026",
    badgeBg: "#bae6fd",
    badgeFg: "#075985",
    points: [
      "Resolved 15+ backend and frontend issues, improving application reliability and cutting down recurring bugs.",
      "Tested and validated 20+ FastAPI endpoints for request handling, response correctness, and API stability.",
      "Contributed to 10+ pull requests through Git-based workflows — collaborative development, proper code reviews.",
    ],
  },
  {
    role: "Full-Stack Developer Intern",
    company: "KUAVA Digital",
    location: "Remote",
    dates: "Oct 2025 – Dec 2025",
    badgeBg: "#fecdd3",
    badgeFg: "#9f1239",
    points: [
      "Built full-stack applications serving 1,000+ daily users with real-time interactions.",
      "Maintained 24+ REST APIs and reduced response latency by 30% — from 13ms down to 9ms.",
      "Designed modular backend architecture and shipped 30+ production-ready features as part of a 6-member team.",
    ],
  },
];

export default function Experience() {
  return (
    <Section id="work">
      <SectionHeading>cool places i work</SectionHeading>
      <div className="list">
        {JOBS.map((job) => (
          <div key={job.company} className="list-item work-item">
            <span
              aria-hidden="true"
              className="company-logo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: job.badgeBg,
                color: job.badgeFg,
                fontFamily:
                  'var(--font-space-grotesk), "Space Grotesk", sans-serif',
                fontSize: "1.25rem",
                fontWeight: 700,
              }}
            >
              {job.company.charAt(0)}
            </span>
            <div className="list-details-block">
              <div className="list-header">
                <span className="list-title">{job.company}</span>
                <span className="list-meta">{job.dates}</span>
              </div>
              <p className="list-role">
                {job.role} • {job.location}
              </p>
              <ul className="list-bullets">
                {job.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
