import { Section, SectionHeading } from "./Section";

const GROUPS: { label: string; items: string }[] = [
  {
    label: "Languages",
    items: "C, C++, Python, Java, JavaScript, SQL, HTML/CSS",
  },
  {
    label: "Frameworks & Tech",
    items: "React, Next.js, Node.js, FastAPI",
  },
  {
    label: "Databases",
    items: "PostgreSQL, MySQL, MongoDB, Redis",
  },
  {
    label: "Tools",
    items: "Git, GitHub, CI/CD, Vercel, Render, AWS",
  },
  {
    label: "Core Concepts",
    items:
      "DSA, OOP, OS, System Design, Computer Networks, Cloud Fundamentals, Multithreading & Concurrency",
  },
];

export default function Skills() {
  return (
    <Section id="skills">
      <SectionHeading>cool things i know</SectionHeading>
      <div className="skills-grid">
        {GROUPS.map((g) => (
          <div key={g.label} className="skill-category">
            <span className="skill-label">{g.label}</span>
            <span className="skill-items">{g.items}</span>
          </div>
        ))}
      </div>
      <p className="list-desc" style={{ marginTop: "2rem" }}>
        <b>LeetCode 1529</b> · 300+ DSA problems solved across platforms
      </p>
    </Section>
  );
}
