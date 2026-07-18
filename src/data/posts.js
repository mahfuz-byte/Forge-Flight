export const POST_TYPES = [
  'Progress Update',
  'Milestone',
  'Milestone Update',
  'Product Launch',
  'Funding Announcement',
  'Collaboration Post',
  'Demo Video',
  'Success Story',
];

export const INITIAL_POSTS = [
  {
    id: 'p-healthsync-1', startupId: 'healthsync', mine: true, media: 'Prototype demo · 0:42', timestamp: '2 hours ago',
    postType: 'Milestone Update', postTitle: 'We just completed our AI prototype.',
    postText: 'Our diagnostic model now runs offline on a $40 device — tested across 6 rural clinics with 94% triage accuracy.',
    tags: ['AI', 'Healthcare', 'Startup'],
  },
  {
    id: 'p-medai-1', startupId: 'medai', tagColor: 'var(--success)', timestamp: '4 hours ago',
    postType: 'Funding Announcement', postTitle: 'Our seed round is now open.',
    postText: "We're raising $200K to bring AI-assisted X-ray review to 25 clinics that currently wait days for a radiologist.",
    tags: ['AI', 'Healthcare', 'Radiology'],
  },
  {
    id: 'p-farmchain-1', startupId: 'farmchain', tagColor: 'var(--info)', timestamp: '6 hours ago',
    postType: 'Collaboration Post', postTitle: "We're hiring a Flutter Developer.",
    postText: 'Help us build the farmer-facing marketplace app that lets smallholders list produce and get paid directly — no middlemen.',
    tags: ['AgriTech', 'Marketplace', 'Mobile'],
  },
  {
    id: 'p-event-1', type: 'event', timestamp: 'Today',
    postTitle: 'Pitch Day — July 30, 6:00 PM',
    postText: 'Eight startups pitch live to our investor network. RSVP to get a reminder and the stream link.',
  },
  {
    id: 'p-ecoride-1', startupId: 'ecoride', tagColor: 'var(--text-muted)', timestamp: '1 day ago',
    postType: 'Milestone', postTitle: 'Reached 5,000 riders this month.',
    postText: 'Our delivery fleet crossed 5,000 active riders across Metro Manila, up 40% since our last update.',
    tags: ['Mobility', 'Climate', 'Logistics'],
  },
  {
    id: 'p-nimbus-1', startupId: 'nimbus', tagColor: 'var(--success)', timestamp: '2 days ago',
    postType: 'Success Story', postTitle: 'Funding completed successfully.',
    postText: 'We closed $250,000 with 3 lead investors — thank you to everyone who backed us during the window.',
    tags: ['Robotics', 'Warehousing', 'AI'],
  },
];

const MORE_POOL = [
  {
    startupId: 'farmchain', tagColor: 'var(--text-muted)',
    postType: 'Progress Update', postTitle: 'Crossed 1,000 onboarded farmers.',
    postText: 'Word of mouth in Kiambu and Machakos counties is doing most of the work — onboarding is up 22% week over week.',
    tags: ['AgriTech', 'Marketplace'],
  },
  {
    startupId: 'ecoride', tagColor: 'var(--info)',
    postType: 'Partnership Announcement', postTitle: 'Partnered with two delivery cooperatives.',
    postText: 'Both cooperatives are switching their last-mile fleet to our swap-battery bikes starting next month.',
    tags: ['Mobility', 'Logistics'],
  },
  {
    startupId: 'medai', tagColor: 'var(--text-muted)',
    postType: 'Team Expansion', postTitle: 'Added a second radiologist co-founder.',
    postText: 'Sofia joins full-time to lead clinical validation across our next three pilot markets.',
    tags: ['Healthcare', 'Radiology'],
  },
  {
    startupId: 'nimbus', tagColor: 'var(--info)',
    postType: 'Product Launch', postTitle: 'Shipped inspection accuracy improvements.',
    postText: 'Our v2 vision model cuts false-positive damage flags by 31% in overnight warehouse runs.',
    tags: ['Robotics', 'AI'],
  },
  {
    startupId: 'healthsync', tagColor: 'var(--success)',
    postType: 'Partnership Announcement', postTitle: 'Signed a regional health NGO for distribution.',
    postText: 'The partnership puts our diagnostic units in front of 40 additional rural clinics by year end.',
    tags: ['Healthcare', 'AI'],
  },
];

let cursor = 0;
export function nextPostBatch(count = 3) {
  const batch = [];
  for (let i = 0; i < count; i += 1) {
    const base = MORE_POOL[cursor % MORE_POOL.length];
    cursor += 1;
    batch.push({ ...base, id: `p-more-${Date.now()}-${i}`, timestamp: `${3 + cursor} days ago` });
  }
  return batch;
}

export const MORE_POOL_SIZE = MORE_POOL.length;
