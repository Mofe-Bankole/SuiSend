import Navbar from "@/components/Navbar";
import FeaturesHero from "@/components/features/FeaturesHero";
import FeatureDetailSection from "@/components/features/FeatureDetailSection";
import ProtocolDeepDive from "@/components/features/ProtocolDeepDive";
import UseCasesSection from "@/components/features/UseCasesSection";
import ComparisonTable from "@/components/features/ComparisonTable";
import FAQSection from "@/components/FAQSection";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <FeaturesHero />
      <FeatureDetailSection />
      <ProtocolDeepDive />
      <UseCasesSection />
      <ComparisonTable />
      <FAQSection />
      <CTA />
      <Footer />
    </>
  );
}