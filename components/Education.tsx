import { Section, SectionHeading } from "./Section";

const SCHOOLS = [
  {
    school: "G.L. Bajaj Institute of Technology and Management, Greater Noida",
    degree: "B.Tech, Computer Science Engineering (Artificial Intelligence)",
    dates: "Oct 2023 – Sep 2027",
    detail: "CGPA 8.3",
  },
  {
    school: "St. Joseph’s Sr. Sec. School, Siswa Bazar",
    degree: "CBSE Higher Secondary School",
    dates: "Apr 2020 – Mar 2022",
    detail: "85%",
  },
];

export default function Education() {
  return (
    <Section id="learn">
      <SectionHeading>cool places i learn</SectionHeading>
      <div className="list">
        {SCHOOLS.map((s) => (
          <div key={s.school} className="list-item">
            <div className="list-header">
              <span className="list-title">{s.school}</span>
              <span className="list-meta">{s.dates}</span>
            </div>
            <p className="list-role">
              {s.degree} · <b>{s.detail}</b>
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
