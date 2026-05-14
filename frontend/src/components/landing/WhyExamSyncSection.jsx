import { motion, useReducedMotion } from "motion/react";
import { Clock, CheckCircle2, Database, Users } from "lucide-react";

const STATS = [
  {
    icon: Clock,
    label: "Minutes, not days",
    description:
      "Generate a full exam schedule automatically — what used to take a week takes seconds.",
  },
  {
    icon: CheckCircle2,
    label: "Zero conflicts",
    description:
      "Every student, room, and instructor is checked automatically. No human error, no oversight.",
  },
  {
    icon: Database,
    label: "No new systems",
    description:
      "Works with CSV exports from whatever you already use. No migration, no IT projects.",
  },
  {
    icon: Users,
    label: "Instant student access",
    description:
      "No portals, no logins, no IT tickets. Students get their schedule the moment it's published.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// Spring-like pop-in for the wow moment #3
const itemVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  },
};

export default function WhyExamSyncSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section id="why-examsync" className="py-20 md:py-28 bg-muted/[0.03]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Why ExamSync</h2>
          <p className="mt-4 text-xl text-muted-foreground">
            Stop building exam schedules in a spreadsheet. There's a better way.
          </p>
        </motion.div>

        {/* Stat cards — wow moment #3: spring pop-in */}
        <motion.div
          variants={shouldReduce ? {} : containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={shouldReduce ? {} : itemVariants}
              className="rounded-xl border border-border bg-card p-8 text-center"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{stat.label}</h3>
              <p className="text-base text-muted-foreground leading-relaxed">{stat.description}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
