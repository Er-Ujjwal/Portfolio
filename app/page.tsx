import Hero from "@/components/Hero";
import About from "@/components/About";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import Education from "@/components/Education";
import Skills from "@/components/Skills";
import Achievements from "@/components/Achievements";
import Connect from "@/components/Connect";
import Visitors from "@/components/Visitors";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Education />
        <Skills />
        <Achievements />
        <Connect />
        <Visitors />
        <div className="footer-quote animate delay-5">You can just do things</div>
      </main>
      <footer>
        <p>&copy; 2026 Ujjwal Rauniyar. Crafted with ❤️.</p>
      </footer>
    </>
  );
}
