const COPY = {
  pending: [
    'This startup is waiting to be approved',
    'Your startup has been registered and is waiting for administrator approval. Until approved, your startup remains private and cannot publish posts, launch investment rounds, recruit collaborators, or appear in the explore section or public searches. Only you (the startup owner) can view and manage this startup.',
  ],
  rejected: [
    'Registration Rejected',
    'This startup was rejected during review. Review the note below, update your details, and resubmit.',
  ],
  suspended: [
    'Suspended',
    'This startup is hidden from the public and cannot take investments. Contact support if you think this is a mistake.',
  ],
};

export default function ReviewNotice({ startup }) {
  if (!startup || startup.reviewStatus === 'approved') return null;
  const copy = COPY[startup.reviewStatus];
  if (!copy) return null;
  return (
    <div className={`review-notice tone-${startup.reviewStatus}`} role="status">
      <b>{copy[0]}</b>
      {copy[1]}
      {startup.reviewNote && <div style={{ marginTop: 6 }}>Note from our team: “{startup.reviewNote}”</div>}
    </div>
  );
}
