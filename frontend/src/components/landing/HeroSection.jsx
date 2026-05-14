import { Link } from "react-router";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DotGridBackground, GrainOverlay } from "@/components/common/PageBackground";
import screenshotDark from "@/assets/ScreenShot_Dark.png";
import screenshotLight from "@/assets/ScreenShot_Light.png";

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function HeroSection() {
  const { resolvedTheme } = useTheme();
  const shouldReduce = useReducedMotion();
  const isDark = resolvedTheme === "dark";

  const fadeUp = (delay = 0) =>
    shouldReduce
      ? {}
      : {
          initial: { opacity: 0, y: 30 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] },
        };

  return (
    <section id="home" className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0">
        <DotGridBackground />
        <GrainOverlay />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isDark
              ? "radial-gradient(ellipse 80% 45% at 50% -5%, oklch(0.68 0.13 265 / 0.13) 0%, transparent 65%)"
              : "radial-gradient(ellipse 80% 45% at 50% -5%, oklch(0.52 0.155 264 / 0.08) 0%, transparent 65%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-12 py-20 lg:py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

          {/* Left: Text */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">

            {/* Badge */}
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Open Source · MIT License
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              {...fadeUp(0.1)}
              className="text-5xl sm:text-6xl lg:text-[5.5rem] font-bold tracking-tight text-foreground leading-[1.05]"
            >
              Exam scheduling.{" "}
              <span className="text-primary">Automated.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p {...fadeUp(0.2)} className="mt-6 text-xl md:text-2xl text-muted-foreground max-w-xl leading-relaxed">
              ExamSync eliminates scheduling conflicts, assigns rooms and instructors automatically,
              and gives students instant access to their timetable.
            </motion.p>

            {/* CTAs */}
            <motion.div
              {...fadeUp(0.3)}
              className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
            >
              <Button size="lg" asChild>
                <Link to="/register">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" onClick={() => scrollTo("how-it-works")}>
                See How It Works
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>

          {/* Right: Screenshot mockup */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative"
          >
            {/* Pulsing glow — wow moment #1 */}
            <motion.div
              className="absolute -inset-6 rounded-2xl blur-3xl -z-10"
              style={{
                background: isDark
                  ? "oklch(0.68 0.13 265 / 0.18)"
                  : "oklch(0.52 0.155 264 / 0.12)",
              }}
              animate={shouldReduce ? {} : { opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Browser mockup */}
            <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-card border-b border-border">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 mx-2 h-5 rounded bg-muted flex items-center px-2.5 text-[11px] text-muted-foreground font-mono">
                  app.examsync.io/exams/new
                </div>
              </div>
              {/* Screenshot */}
              <img
                src={isDark ? screenshotDark : screenshotLight}
                alt="ExamSync — New Exam Period page"
                className="w-full block"
                loading="eager"
              />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
