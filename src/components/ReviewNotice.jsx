// Tells a founder why their startup isn't public yet (Phase 6 startup review).
const COPY = {
  pending: ['Waiting for review', 'Only you can see this startup until our team approves it. This usually takes a day or two.'],
  rejected: ['Not approved yet', 'Update the details below and it will be reviewed again automatically.'],
  suspended: ['Suspended', 'This startup is hidden from the public and can’t take investments. Contact support if you think this is a mistake.'],
};

export default function ReviewNotice({ startup }) {
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
