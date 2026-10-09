import { Section, SectionHeading } from "./Section";

type Bullet = { lead: string; rest: string };

const PROJECTS: {
  name: string;
  tag: string;
  tagline: string;
  points: Bullet[];
}[] = [
  {
    name: "GigWise",
    tag: "Nov 2025 – Feb 2026",
    tagline: "AI-powered income protection platform for gig workers.",
    points: [
      {
        lead: "Built 15 production-grade APIs",
        rest: " and 2 role-based portals with secure authentication.",
      },
      {
        lead: "ML-assisted fraud scoring",
        rest: " with automated claim routing.",
      },
      {
        lead: "Dockerized the complete stack",
        rest: " for reproducible deployments.",
      },
    ],
  },
  {
    name: "Raahi",
    tag: "Sep 2025 – Oct 2025",
    tagline: "Smart tourist safety monitoring system for travelers in remote areas.",
    points: [
      {
        lead: "Designed SOS escalation workflows",
        rest: " and an admin dashboard for live incident tracking.",
      },
      {
        lead: "Improved processing efficiency 6×",
        rest: " — response time dropped from 60 seconds to 10.",
      },
    ],
  },
];

export default function Projects() {
  return (
    <Section id="build">
      <SectionHeading>cool things i build</SectionHeading>
      <div className="list">
        {PROJECTS.map((p) => (
          <div key={p.name} className="list-item">
            <div className="list-header">
              <span className="list-title">{p.name}</span>
              <span className="list-meta">{p.tag}</span>
            </div>
            <p className="list-role">{p.tagline}</p>
            <ul className="list-bullets">
              {p.points.map((pt) => (
                <li key={pt.lead}>
                  <b>{pt.lead}</b>
                  {pt.rest}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
