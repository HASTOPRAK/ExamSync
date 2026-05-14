import { useState } from "react";
import { Link } from "react-router";
import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import { Menu, Sun, Moon } from "lucide-react";
import GithubIcon from "@/components/landing/GithubIcon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS = [
  { label: "How It Works", id: "how-it-works" },
  { label: "Features", id: "features" },
  { label: "Why ExamSync", id: "why-examsync" },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function LandingNav() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-12">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src={isDark ? "/examsync-brand/mark-40px-dark.svg" : "/examsync-brand/mark-40px.svg"}
              alt="ExamSync mark"
              className="h-8 w-8"
            />
            <img
              src={isDark ? "/examsync-brand/wordmark-dark.svg" : "/examsync-brand/wordmark-light.svg"}
              alt="ExamSync"
              className="h-5"
            />
          </Link>

          {/* Desktop center nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            <a
              href="https://github.com/HASTOPRAK/ExamSync"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Get Started</Link>
            </Button>
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="ml-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          {/* Mobile right */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col gap-6 pt-6">
                  <div className="flex flex-col gap-1">
                    {NAV_LINKS.map((link) => (
                      <button
                        key={link.id}
                        onClick={() => { scrollTo(link.id); setMobileOpen(false); }}
                        className="text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                      >
                        {link.label}
                      </button>
                    ))}
                    <a
                      href="https://github.com/HASTOPRAK/ExamSync"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      <GithubIcon className="h-4 w-4" />
                      GitHub
                    </a>
                  </div>
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <Button variant="outline" asChild>
                      <Link to="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
                    </Button>
                    <Button asChild>
                      <Link to="/register" onClick={() => setMobileOpen(false)}>Get Started</Link>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

      </div>
    </header>
  );
}
