import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import GithubIcon from "@/components/landing/GithubIcon";
import { Button } from "@/components/ui/button";

export default function FinalCTASection() {
  const shouldReduce = useReducedMotion();

  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55 }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Join the ExamSync community
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Open source, MIT licensed, built for universities.
            Use it, fork it, contribute to it.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a
                href="https://github.com/HASTOPRAK/ExamSync"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GithubIcon className="mr-2 h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
