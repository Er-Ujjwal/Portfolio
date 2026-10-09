import { Section, SectionHeading } from "./Section";
import { EMAIL, GITHUB_URL, LINKEDIN_URL } from "@/lib/config";

const LINKS = [
  { label: "GitHub", href: GITHUB_URL },
  { label: "LinkedIn", href: LINKEDIN_URL },
  { label: "Email", href: `mailto:${EMAIL}` },
];

export default function Connect() {
  return (
    <Section id="connect">
      <SectionHeading>connect</SectionHeading>
      <div className="links-grid">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("mailto") ? undefined : "_blank"}
            rel="noreferrer"
          >
            {l.label}
          </a>
        ))}
      </div>
    </Section>
  );
}
