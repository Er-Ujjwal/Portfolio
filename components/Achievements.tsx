import { Section, SectionHeading } from "./Section";

const WINS = [
  {
    title: "Top 100 — Guidewire DevTrails 2026",
    detail:
      "Ranked among the top 100 teams out of 4,000+ — built GigWise. 5-star rated.",
  },
  {
    title: "4th Place — HackOClock ’26",
    detail:
      "4th out of 500+ teams with an AI-powered automated lead generation platform.",
  },
  {
    title: "Top 5 Finalist — Designathon ’25 (DTU)",
    detail:
      "Top 5 out of ~350 teams (1,900+ participants) with a sustainability-focused rewards platform.",
  },
];

export default function Achievements() {
  return (
    <Section id="wins">
      <SectionHeading>cool things i won</SectionHeading>
      <div className="list">
        {WINS.map((w) => (
          <div key={w.title} className="list-item">
            <div className="list-header">
              <span className="list-title">{w.title}</span>
            </div>
            <p className="list-desc">{w.detail}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
