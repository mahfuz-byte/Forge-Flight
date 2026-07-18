export const LOGO_GRADIENTS = {
  healthsync: 'linear-gradient(155deg,#4f7089,#2c4a5f)',
  ecoride: 'linear-gradient(155deg,#5f7a57,#38492f)',
  farmchain: 'linear-gradient(155deg,#b98a34,#7a5a1f)',
  medai: 'linear-gradient(155deg,#eb5e28,#a83f16)',
  nimbus: 'linear-gradient(155deg,#403d39,#252422)',
};

export const STARTUPS = {
  healthsync: {
    name: 'HealthSync', initials: 'HS', verified: true, founder: 'Amara Chen', ownerId: 'amara-chen',
    tagline: 'Diagnostic AI for rural clinics · Healthcare · Dhaka, BD',
    status: 'open', tags: ['AI', 'Healthcare', 'Startup'],
    goal: 120000, raised: 82000, deadline: '3 days left',
    postType: 'Milestone Update', postTitle: 'We just completed our AI prototype.',
    postText: 'Our diagnostic model now runs offline on a $40 device — tested across 6 rural clinics with 94% triage accuracy.',
    overview: 'HealthSync builds low-cost diagnostic AI that runs on offline hardware, so rural clinics without reliable internet can screen patients for common conditions in under two minutes. The team is currently closing a seed round to fund clinical trials across 40 additional clinics.',
    team: [['Amara Chen', 'Founder & CEO'], ['Rafael Ibarra', 'Co-founder, ML'], ['Priya Nair', 'Clinical Lead'], ['Tomas Berg', 'Hardware Eng.']],
    timeline: [
      ['Jul 2026', 'Prototype released', 'Offline diagnostic model deployed across 6 pilot clinics.'],
      ['May 2026', 'MVP completed', 'First working version validated against 1,200 patient cases.'],
      ['Feb 2026', 'Team formed', 'Clinical lead and hardware engineer joined full-time.'],
      ['Nov 2025', 'Idea stage', 'Founded after a rural health survey in three districts.'],
    ],
    docs: [['Pitch Deck.pdf', '2.4 MB'], ['Clinical Trial Summary.pdf', '1.1 MB'], ['Product One-Pager.pdf', '480 KB']],
    collab: { role: 'Flutter Developer', body: 'Help us build the clinic-facing companion app that syncs diagnostic results when connectivity returns.' },
    updates: ['Reached 6 pilot clinics ahead of schedule.', 'Closed a partnership with a regional health NGO for distribution.', 'Hardware cost per unit down to $40, from $65 at prototype stage.'],
    comments: [['Priya Nair', 'This triage flow is going to save so much clinician time.', '2h'], ['David Osei', 'Would love to pilot this in Kumasi — DMing you.', '5h']],
  },
  ecoride: {
    name: 'EcoRide', initials: 'ER', verified: true, founder: 'Lena Torres', ownerId: 'lena-torres',
    tagline: 'Electric micromobility for last-mile delivery · Mobility · Manila, PH',
    status: 'closed', tags: ['Mobility', 'Climate', 'Logistics'],
    goal: 80000, raised: 80000, deadline: 'Funding closed',
    postType: 'Milestone', postTitle: 'Reached 5,000 riders this month.',
    postText: 'Our delivery fleet crossed 5,000 active riders across Metro Manila, up 40% since our last update.',
    overview: 'EcoRide operates a swap-battery e-bike fleet built for last-mile delivery riders, cutting fuel cost and emissions for delivery partners. The seed round closed in June; the team is now focused on expanding to two new cities.',
    team: [['Lena Torres', 'Founder & CEO'], ['Marco Villanueva', 'Operations'], ['Hana Suzuki', 'Fleet Engineering']],
    timeline: [
      ['Jun 2026', 'Seed round closed', '$80,000 raised from 4 investors.'],
      ['Apr 2026', '5,000 riders', 'Crossed 5K active riders across Metro Manila.'],
      ['Jan 2026', 'Public launch', 'Opened battery-swap stations in 3 districts.'],
    ],
    docs: [['Pitch Deck.pdf', '3.1 MB'], ['Fleet Economics.xlsx', '220 KB']],
    collab: { role: 'Field Operations Lead', body: 'Manage battery-swap station rollout as we expand into two new cities this quarter.' },
    updates: ['Crossed 5,000 active riders.', 'Opened 2 new swap stations in Quezon City.', 'Reduced average delivery time by 12%.'],
    comments: [['Marco Villanueva', 'Great milestone team, onward to city #2.', '1d']],
  },
  medai: {
    name: 'MedAI', initials: 'MA', verified: false, founder: 'Daniel Kwesi', ownerId: 'daniel-kwesi',
    tagline: 'AI-assisted radiology review · Healthcare · Accra, GH',
    status: 'open', tags: ['AI', 'Healthcare', 'Radiology'],
    goal: 200000, raised: 54000, deadline: '5 days left',
    postType: 'Funding Announcement', postTitle: 'Our seed round is now open.',
    postText: "We're raising $200K to bring AI-assisted X-ray review to 25 clinics that currently wait days for a radiologist.",
    overview: 'MedAI flags likely abnormalities in chest X-rays within seconds, giving clinics without an on-site radiologist a fast second opinion. The current round funds regulatory review and a 25-clinic rollout.',
    team: [['Daniel Kwesi', 'Founder & CEO'], ['Sofia Lindqvist', 'Co-founder, Radiology']],
    timeline: [
      ['Jul 2026', 'Funding round opened', 'Raising $200,000 seed round.'],
      ['Mar 2026', 'Regulatory submission', 'Filed for clinical use approval.'],
      ['Dec 2025', 'Prototype validated', '92% sensitivity across 800 test images.'],
    ],
    docs: [['Pitch Deck.pdf', '2.8 MB'], ['Regulatory Filing Summary.pdf', '640 KB']],
    collab: { role: 'Regulatory Affairs Consultant', body: 'Guide our clinical approval process across two additional markets.' },
    updates: ['Opened seed round at $200K target.', 'Filed for clinical use approval.', 'Added a second radiologist co-founder.'],
    comments: [['Sofia Lindqvist', 'Excited to get this into more clinics.', '4h']],
  },
  farmchain: {
    name: 'FarmChain', initials: 'FC', verified: true, founder: 'Grace Mwangi', ownerId: 'grace-mwangi',
    tagline: 'Marketplace connecting smallholder farmers to buyers · AgriTech · Nairobi, KE',
    status: 'soon', tags: ['AgriTech', 'Marketplace', 'Mobile'],
    goal: 95000, raised: 38000, deadline: '7 days left',
    postType: 'Collaboration Post', postTitle: "We're hiring a Flutter Developer.",
    postText: 'Help us build the farmer-facing marketplace app that lets smallholders list produce and get paid directly — no middlemen.',
    overview: 'FarmChain lets smallholder farmers list produce directly to verified buyers and cooperatives, settling payment same-day. The team is opening a funding round to fund the mobile app rebuild in Flutter.',
    team: [['Grace Mwangi', 'Founder & CEO'], ['Samuel Otieno', 'Co-founder, Ops'], ['Wanjiru Kamau', 'Farmer Relations']],
    timeline: [
      ['Jul 2026', 'Collaboration post opened', 'Hiring for the Flutter rebuild.'],
      ['May 2026', '1,000 farmers onboarded', 'Crossed 1,000 registered sellers.'],
      ['Jan 2026', 'Pilot launch', 'Piloted in 2 counties with 60 farmers.'],
    ],
    docs: [['Pitch Deck.pdf', '1.9 MB'], ['Farmer Onboarding Guide.pdf', '310 KB']],
    collab: { role: 'Flutter Developer', body: 'Rebuild our farmer-facing marketplace app in Flutter — produce listing, offline sync, direct payments.' },
    updates: ['Crossed 1,000 onboarded farmers.', 'Opened a Flutter Developer role.', 'Signed 2 new buyer cooperatives.'],
    comments: [['Samuel Otieno', 'Applications are already coming in — nice.', '6h']],
  },
  nimbus: {
    name: 'Nimbus Robotics', initials: 'NR', verified: true, founder: 'Wei Zhang', ownerId: 'wei-zhang',
    tagline: 'Autonomous warehouse inspection drones · Robotics · Singapore',
    status: 'closed', tags: ['Robotics', 'Warehousing', 'AI'],
    goal: 250000, raised: 250000, deadline: 'Funding closed',
    postType: 'Success Story', postTitle: 'Funding completed successfully.',
    postText: 'We closed $250,000 with 3 lead investors — thank you to everyone who backed us during the window.',
    overview: 'Nimbus Robotics builds autonomous drones that inspect warehouse shelving for damage and stock errors overnight. The team just closed a $250,000 round with 3 lead investors and is hiring across engineering.',
    team: [['Wei Zhang', 'Founder & CEO'], ['Ines Fontaine', 'Co-founder, Robotics'], ['Arjun Mehta', 'Computer Vision']],
    timeline: [
      ['Jun 2026', 'Funding closed', '$250,000 raised with 3 lead investors.'],
      ['Mar 2026', 'Funding round opened', 'Opened a $250K seed round.'],
      ['Oct 2025', 'First deployment', 'Piloted overnight inspection in a single warehouse.'],
    ],
    docs: [['Pitch Deck.pdf', '4.2 MB'], ['Investor Update — Q2.pdf', '510 KB']],
    collab: { role: 'Robotics Engineer', body: 'Join the team building our next-gen inspection drone fleet.' },
    updates: ['Closed $250,000 seed round.', 'Signed 2 new warehouse operator clients.', 'Shipped inspection accuracy improvements.'],
    comments: [['Ines Fontaine', 'So proud of this team.', '2d']],
  },
};

export function statusMeta(status) {
  if (status === 'open') return { cls: 'status-open', label: 'Funding Open' };
  if (status === 'soon') return { cls: 'status-soon', label: 'Opening Soon' };
  if (status === 'closed') return { cls: 'status-closed', label: 'Funding Closed' };
  return { cls: 'status-info', label: 'Collaboration' };
}

export function fmtMoney(n) {
  return '$' + n.toLocaleString('en-US');
}

export function fundingPct(raised, goal) {
  return goal > 0 ? Math.round((raised / goal) * 100) : 0;
}

export function initialsOf(name) {
  return name.split(' ').map((p) => p[0]).join('');
}

export function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'startup';
}
