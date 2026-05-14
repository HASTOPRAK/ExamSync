import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudentAccessSection() {
  const shouldReduce = useReducedMotion();

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-8"
        >
          {/* Icon */}
          <div className="h-16 w-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>

          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Students don't need an account
            </h3>
            <p className="text-muted-foreground text-base md:text-lg">
              Once a schedule is published, students enter their student number to see every exam —
              date, time, room, and course. No registration, no app, no IT support needed.
            </p>
          </div>

          {/* CTA */}
          <Button variant="outline" asChild className="shrink-0">
            <Link to="/check-schedule">
              Try it
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
