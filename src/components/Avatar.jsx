import { useState } from 'react';
import { initialsOf } from '../data/startups';

/**
 * A person's uploaded photo, falling back to their initials (FE-11).
 * Renders inside the existing `.avatar` circle so sizes and colors stay the same.
 */
export default function Avatar({ src, name = '', initials, size, className = 'avatar', title, onClick, as = 'div' }) {
  const [broken, setBroken] = useState(false);
  const Tag = onClick ? 'button' : as;
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.36) } : undefined;
  const label = initials || initialsOf(name || '?');
  const showImage = src && !broken;

  return (
    <Tag
      className={className}
      style={{ ...style, ...(showImage ? { padding: 0, overflow: 'hidden' } : null) }}
      title={title}
      onClick={onClick}
      type={Tag === 'button' ? 'button' : undefined}
    >
      {showImage ? (
        <img
          src={src}
          alt={name ? `${name}'s photo` : ''}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      ) : label}
    </Tag>
  );
}
