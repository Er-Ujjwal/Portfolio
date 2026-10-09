import { Section, SectionHeading } from "./Section";

export default function About() {
  return (
    <Section id="about">
      <SectionHeading>about</SectionHeading>
      <p>
        I&apos;m a B.Tech Computer Science Engineering (Artificial Intelligence)
        student at <b>G.L. Bajaj Institute of Technology and Management</b>,
        graduating in 2027. I&apos;m focused on becoming a strong software
        engineer — the kind who can reason from first principles, not just
        stitch APIs together.
      </p>
      <p>
        Most of my time goes into <b>DSA</b>, <b>full-stack development</b>,
        and <b>AI/ML</b>. I learn by building: real products, real internships,
        real hackathons — the messy kind where things break at 2am and you
        actually remember the fix.
      </p>
      <p>
        When I&apos;m not coding, I&apos;m probably grinding LeetCode (300+
        problems and counting), tinkering with system design, watching movies,
        listening to music, or wondering why my Redis cache just evicted
        everything.
      </p>
    </Section>
  );
}
