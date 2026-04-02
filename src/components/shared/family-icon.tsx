interface FamilyIconProps {
  className?: string;
}

export function FamilyIcon({ className = "w-16 h-16" }: FamilyIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} fill="currentColor">
      {/* Parent left (shorter/feminine) */}
      <circle cx="30" cy="16" r="9" />
      <path d="M21 30c0-2.5 2-4.5 4.5-4.5h9c2.5 0 4.5 2 4.5 4.5v20c0 1.1-.9 2-2 2h-1v18c0 1.7-1.3 3-3 3s-3-1.3-3-3V52h-2v18c0 1.7-1.3 3-3 3s-3-1.3-3-3V52h-1c-1.1 0-2-.9-2-2V30z" />
      {/* Parent right (taller) */}
      <circle cx="70" cy="13" r="10" />
      <path d="M60 28c0-2.8 2.2-5 5-5h10c2.8 0 5 2.2 5 5v24c0 1.1-.9 2-2 2h-1v20c0 1.7-1.3 3-3 3s-3-1.3-3-3V54h-2v20c0 1.7-1.3 3-3 3s-3-1.3-3-3V54h-1c-1.1 0-2-.9-2-2V28z" />
      {/* Child center (arms up) */}
      <circle cx="50" cy="38" r="7" />
      <path d="M43 50c0-1.9 1.6-3.5 3.5-3.5h7c1.9 0 3.5 1.6 3.5 3.5v12c0 .8-.7 1.5-1.5 1.5H55v14c0 1.4-1.1 2.5-2.5 2.5S50 78.9 50 77.5V63.5h-1v14c0 1.4-1.1 2.5-2.5 2.5S44 78.9 44 77.5V63.5h-.5c-.8 0-1.5-.7-1.5-1.5V50z" />
      {/* Left arm up */}
      <path d="M44 50l-7-8c-1-1.2-.5-2.5.8-2.5s2 .6 2.8 1.5L47 48" />
      {/* Right arm up */}
      <path d="M56 50l7-8c1-1.2.5-2.5-.8-2.5s-2 .6-2.8 1.5L53 48" />
    </svg>
  );
}
