import { cn } from "@/lib/utils/cn";

export function RetroGrid({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden opacity-50 [perspective:200px]",
        className
      )}
    >
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
      
      {/* Grid */}
      <div
        className="absolute inset-0 [transform:rotateX(35deg)]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(58, 123, 213, 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(58, 123, 213, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />
      </div>
      
      {/* Glow Effect */}
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3A7BD5] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#3A7BD5] to-transparent" />
      </div>
      
      {/* Animated Gradient Orb */}
      <div 
        className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#3A7BD5]/20 via-[#7ED957]/20 to-[#3A7BD5]/20 blur-3xl animate-pulse"
      />
    </div>
  );
}

