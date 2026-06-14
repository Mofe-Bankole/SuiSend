import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsStrip from "@/components/StatsStrip";
import MarqueeSection from "@/components/MarqueeSection";
import HowItWorks from "@/components/HowItWorks";
import PersonasSection from "@/components/PersonasSection";
import ComparisonSection from "@/components/ComparisonSection";
import DemoSection from "@/components/DemoSection";
import RoadmapSection from "@/components/RoadmapSection";
import FAQSection from "@/components/FAQSection";
import ProtocolStrip from "@/components/ProtocolStrip";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsStrip />
      <MarqueeSection />
      <HowItWorks />
      <PersonasSection />
      <ComparisonSection />
      <DemoSection />
      <RoadmapSection />
      <FAQSection />
      <ProtocolStrip />
      <CTA />
      <Footer />
    </>
  );
}
