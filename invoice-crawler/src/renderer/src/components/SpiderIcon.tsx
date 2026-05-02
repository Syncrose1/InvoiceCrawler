interface SpiderIconProps {
  className?: string;
  size?: number;
}

export default function SpiderIcon({ className, size = 24 }: SpiderIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Body — abdomen and head/cephalothorax */}
      <ellipse cx="12" cy="13.5" rx="3.4" ry="3.8" fill="currentColor" fillOpacity={0.18} />
      <circle cx="12" cy="9.6" r="1.9" fill="currentColor" fillOpacity={0.25} />
      {/* Eyes */}
      <circle cx="11.1" cy="9.4" r="0.45" fill="currentColor" stroke="none" />
      <circle cx="12.9" cy="9.4" r="0.45" fill="currentColor" stroke="none" />
      {/* Front-left leg pair */}
      <path d="M9.2 10.4 L5.5 8.2 L4 9.6" />
      <path d="M9.4 11.6 L5.2 11.2 L3.5 12.6" />
      {/* Back-left leg pair */}
      <path d="M9.4 13.6 L5.4 14.6 L4 16.4" />
      <path d="M9.6 14.8 L6.4 17 L5.4 19" />
      {/* Front-right leg pair */}
      <path d="M14.8 10.4 L18.5 8.2 L20 9.6" />
      <path d="M14.6 11.6 L18.8 11.2 L20.5 12.6" />
      {/* Back-right leg pair */}
      <path d="M14.6 13.6 L18.6 14.6 L20 16.4" />
      <path d="M14.4 14.8 L17.6 17 L18.6 19" />
      {/* Silk thread */}
      <path d="M12 5.6 L12 7.7" strokeDasharray="0.8 1.2" />
    </svg>
  );
}
