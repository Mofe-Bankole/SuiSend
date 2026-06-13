import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsStrip from "@/components/StatsStrip";
import HowItWorks from "@/components/HowItWorks";
import DemoSection from "@/components/DemoSection";
import ProtocolStrip from "@/components/ProtocolStrip";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <StatsStrip />
      <HowItWorks />
      <DemoSection />
      <ProtocolStrip />
      <CTA />
      <Footer />
    </>
  );
}
