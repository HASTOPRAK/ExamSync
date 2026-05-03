import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PageSection({ title, description, action, children }) {
  return (
    <Card className="border-slate-800 bg-slate-900/70 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-slate-100">
            {title}
          </CardTitle>
          {action}
        </div>

        {description ? (
          <p className="text-sm text-slate-400">{description}</p>
        ) : null}
      </CardHeader>

      <CardContent>{children}</CardContent>
    </Card>
  );
}
