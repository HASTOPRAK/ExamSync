import markUrl from "@/assets/mark-40.svg";

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
      <img src={markUrl} alt="ExamSync" className="h-14 w-14 animate-pulse" />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      </div>
    </div>
  );
}
