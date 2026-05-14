import { motion, useReducedMotion } from "motion/react";
import { Upload, Zap, Share2 } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    title: "Import your data",
    description:
      "Upload your rooms, courses, instructors, and student enrollments via CSV — straight from your existing spreadsheets.",
  },
  {
    icon: Zap,
    title: "Generate the schedule",
    description:
      "ExamSync automatically assigns exams to rooms and time slots, detecting and resolving every conflict in seconds.",
  },
  {
    icon: Share2,
    title: "Share with students",
    description:
      "Students instantly look up their personal timetable with just their student number — no accounts, no IT tickets.",
  },
];

export default function HowItWorksSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-muted/3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            How it works
          </h2>
          <p className="mt-4 text-xl text-muted-foreground">
            From raw data to a published exam schedule in three steps.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting dashed line — desktop only */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px border-t border-dashed border-border/70" />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.13 }}
              className="flex flex-col items-center text-center relative"
            >
              {/* Icon circle with step number badge */}
              <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xs">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
