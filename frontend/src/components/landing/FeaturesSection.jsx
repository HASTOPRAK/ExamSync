import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck, Building2, Users, BarChart3 } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Conflict Detection",
    description:
      "No student sits two exams at once. No room is double-booked. No instructor is scheduled twice. Every constraint is automatically verified before the schedule is published.",
  },
  {
    icon: Building2,
    title: "Room & Instructor Assignment",
    description:
      "Automatically assigns the right venue and supervisor to every exam based on enrollment size, room capacity, and instructor availability.",
  },
  {
    icon: Users,
    title: "Student Schedule Lookup",
    description:
      "Students check their personal exam timetable instantly — no login required. Just their student number and they see every exam: date, time, room, and course.",
  },
  {
    icon: BarChart3,
    title: "Schedule Quality Scoring",
    description:
      "See how optimized your schedule is before publishing it. Quality metrics help you compare generated schedules and pick the best one.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function FeaturesSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section id="features" className="py-20 md:py-28">
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
            Built for the job
          </h2>
          <p className="mt-4 text-xl text-muted-foreground">
            Every feature exists because manual scheduling made someone's week
            terrible.
          </p>
        </motion.div>

        {/* Feature cards — wow moment #2: staggered reveal */}
        <motion.div
          variants={shouldReduce ? {} : containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={shouldReduce ? {} : itemVariants}
              className="group rounded-xl border border-border bg-card p-8 hover:border-primary/40 hover:bg-primary/2 transition-colors duration-200"
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
