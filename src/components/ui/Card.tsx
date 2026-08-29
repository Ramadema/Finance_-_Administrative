import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHead({
  titulo, sub, accion, className,
}: {
  titulo: React.ReactNode;
  sub?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-2", className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase"
            style={{ color: "var(--ink-secundario)" }}>
          {titulo}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--ink-mudo)" }}>{sub}</p>
        )}
      </div>
      {accion}
    </div>
  );
}
