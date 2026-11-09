// The real state of an investment request or collaboration application (FE-01 / FE-02).
const STATUS = {
  pending: ['Pending review', 'status-soon'],
  accepted: ['Accepted', 'status-open'],
  completed: ['Completed', 'status-open'],
  rejected: ['Rejected', 'status-closed'],
  declined: ['Declined', 'status-closed'],
  withdrawn: ['Withdrawn', 'status-closed'],
};

export function requestStatusLabel(status) {
  return (STATUS[status] || [status])[0];
}

export default function RequestStatus({ status }) {
  const [label, cls] = STATUS[status] || [status, 'status-closed'];
  return <span className={`status-pill ${cls}`}>{label}</span>;
}
