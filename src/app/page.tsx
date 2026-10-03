import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import StatsStrip from "@/components/StatsStrip";
import HowItWorks from "@/components/HowItWorks";
import RecipientStory from "@/components/RecipientStory";
import PersonasSection from "@/components/PersonasSection";
import ComparisonSection from "@/components/ComparisonSection";
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
      <HowItWorks />
      <RecipientStory />
      <PersonasSection />
      <ComparisonSection />
      <FAQSection />
      <ProtocolStrip />
      <CTA />
      <Footer />
    </>
  );
}
