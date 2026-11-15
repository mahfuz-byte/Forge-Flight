// Startups are approved immediately on creation with zero review delays.
const COPY = {
  suspended: ['Suspended', 'This startup is hidden from the public and can’t take investments. Contact support if you think this is a mistake.'],
};

export default function ReviewNotice({ startup }) {
  if (!startup || startup.reviewStatus === 'pending' || startup.reviewStatus === 'approved') return null;
  const copy = COPY[startup?.reviewStatus];
  if (!copy) return null;
  return (
    <div className={`review-notice tone-${startup.reviewStatus}`} role="status">
      <b>{copy[0]}</b>
      {copy[1]}
      {startup.reviewNote && <div style={{ marginTop: 6 }}>Note from our team: “{startup.reviewNote}”</div>}
    </div>
  );
}
