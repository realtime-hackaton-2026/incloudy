/*
 * frontend/src/guide/Owl.tsx // a small geometric owl icon, built from
 * shapes rather than an image asset — there's no owl artwork anywhere in
 * the repo (checked assets/images/*, only human avatars and map scenes
 * exist), so this doesn't pretend to match any particular reference art.
 * Simple enough to reskin later if real pixel art shows up.
 */

export function Owl({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Guía búho"
    >
      {/* Ear tufts */}
      <path d="M8 6 L11 2 L12 8 Z" fill="#8a6a4a" />
      <path d="M24 6 L21 2 L20 8 Z" fill="#8a6a4a" />
      {/* Body */}
      <ellipse cx="16" cy="18" rx="11" ry="10" fill="#a8825a" />
      <ellipse cx="16" cy="19" rx="7.5" ry="7" fill="#e6c995" />
      {/* Eyes */}
      <circle cx="11.5" cy="16" r="4.4" fill="#fdfbf7" />
      <circle cx="20.5" cy="16" r="4.4" fill="#fdfbf7" />
      <circle cx="11.5" cy="16" r="2.2" fill="#241705" />
      <circle cx="20.5" cy="16" r="2.2" fill="#241705" />
      {/* Beak */}
      <path d="M14.5 20 L16 24 L17.5 20 Z" fill="#e2913f" />
      {/* Feet */}
      <path d="M12 27 L12 30 M10.5 30 L13.5 30" stroke="#8a6a4a" strokeWidth="1.4" />
      <path d="M20 27 L20 30 M18.5 30 L21.5 30" stroke="#8a6a4a" strokeWidth="1.4" />
    </svg>
  )
}
