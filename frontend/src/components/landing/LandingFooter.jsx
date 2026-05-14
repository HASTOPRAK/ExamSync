import { Link } from "react-router";
import { useTheme } from "next-themes";
import GithubIcon from "@/components/landing/GithubIcon";

export default function LandingFooter() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <footer className="border-t border-border py-10 px-4 sm:px-6 lg:px-12">

        {/* Top row */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">

          {/* Brand */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2.5">
              <img
                src={isDark ? "/examsync-brand/mark-40px-dark.svg" : "/examsync-brand/mark-40px.svg"}
                alt="ExamSync mark"
                className="h-7 w-7"
              />
              <img
                src={isDark ? "/examsync-brand/wordmark-dark.svg" : "/examsync-brand/wordmark-light.svg"}
                alt="ExamSync"
                className="h-4"
              />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs text-center md:text-left">
              Automated exam scheduling for universities.
              Open source, MIT licensed.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>
            <Link to="/check-schedule" className="hover:text-foreground transition-colors">Student Schedule</Link>
            <a
              href="https://github.com/HASTOPRAK/ExamSync"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-muted-foreground">
          <span>© 2026 ExamSync. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5">
            MIT License
          </span>
        </div>

    </footer>
  );
}
