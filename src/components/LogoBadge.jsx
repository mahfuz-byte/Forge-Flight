import { LOGO_GRADIENTS } from '../data/startups';

export default function LogoBadge({ id, initials, size, children }) {
  const style = {
    background: LOGO_GRADIENTS[id] || 'var(--c-umber)',
    ...(size ? { width: size, height: size, fontSize: Math.round(size * 0.34) } : {}),
  };
  return (
    <div className="logo-badge" style={style}>
      {children ?? initials}
    </div>
  );
}
