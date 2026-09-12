'use client';

import { useState } from 'react';

/**
 * Logo de emisora o canal. Los favicons vienen de cientos de dominios ajenos y
 * una buena parte estan caidos o son HTML disfrazado de imagen, asi que el
 * fallback a iniciales no es un detalle: es el caso comun.
 */
export function StationLogo({
  src,
  name,
  size = 48,
  rounded = 'rounded-lg',
}: {
  src?: string | null;
  name: string;
  size?: number;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  if (!src || failed) {
    return (
      <div
        className={`${rounded} flex shrink-0 items-center justify-center bg-ink-800 text-ink-300`}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
        aria-hidden
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${rounded} shrink-0 bg-ink-900 object-cover`}
      style={{ width: size, height: size }}
    />
  );
}
