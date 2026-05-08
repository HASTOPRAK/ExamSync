import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PageSection({ title, description, action, variant, children, className }) {
  return (
    <Card
      className={cn(
        "border-border bg-card shadow-sm",
        variant === "info"    && "panel-info",
        variant === "success" && "panel-success",
        variant === "warning" && "panel-warning",
        variant === "error"   && "panel-error",
        className,
      )}
    >
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-display text-base font-semibold text-foreground">
            {title}
          </CardTitle>
          {action}
        </div>

        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>

      <CardContent>{children}</CardContent>
    </Card>
  );
}
