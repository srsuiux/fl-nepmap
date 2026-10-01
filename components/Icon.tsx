import { ICON_PATHS, type IconName } from "@/lib/icons";

export function Icon({ name, size = 18, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICON_PATHS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// Round coloured badge with a white icon, matching the markers on the map.
export function Badge({ name, color, size = 26 }: { name: IconName; color: string; size?: number }) {
  return (
    <span className="badge" style={{ background: color, width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.62)} strokeWidth={2.2} />
    </span>
  );
}
