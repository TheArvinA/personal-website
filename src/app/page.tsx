import { Nav } from "@/components/Nav";
import { ScrollRail } from "@/components/ScrollRail";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Projects } from "@/components/sections/Projects";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      <Nav />
      <ScrollRail />
      <main className="relative">
        <Hero />
        <About />
        <Projects />
        <Contact />
      </main>
    </>
  );
}
