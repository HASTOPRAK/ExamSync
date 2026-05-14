import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import WhyExamSyncSection from "@/components/landing/WhyExamSyncSection";
import StudentAccessSection from "@/components/landing/StudentAccessSection";
import FinalCTASection from "@/components/landing/FinalCTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <WhyExamSyncSection />
        <StudentAccessSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
