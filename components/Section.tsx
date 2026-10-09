import type { ReactNode } from "react";

const DELAYS: Record<string, string> = {
  about: "delay-1",
  work: "delay-2",
  build: "delay-3",
};

export function Section({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`animate ${DELAYS[id] ?? "delay-4"}`}>
      {children}
    </section>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}
