// Admin navigation (Phase 5.1). Each entry names the capability the server
// grants per role (backend/adminpanel/capabilities.py); entries the signed-in
// admin lacks are not shown. The server still checks every request.
// `ready: false` hides an entry that isn't built yet.
export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'chart', capability: 'dashboard.view', ready: true, end: true },
  { to: '/admin/users', label: 'Users', icon: 'user', capability: 'users.view', ready: true },
  { to: '/admin/startups', label: 'Startups', icon: 'flag', capability: 'startups.view', ready: true },
  { to: '/admin/investments', label: 'Investments', icon: 'coin', capability: 'investments.view', ready: true },
  { to: '/admin/collaborations', label: 'Collaborations', icon: 'handshake', capability: 'collaborations.view', ready: true },
  { to: '/admin/community', label: 'Community', icon: 'comment', capability: 'content.moderate', ready: true },
  { to: '/admin/reports', label: 'Reports', icon: 'flag', capability: 'reports.manage', ready: true },
  { to: '/admin/notifications', label: 'Announcements', icon: 'bell', capability: 'notifications.send', ready: true },
  { to: '/admin/analytics', label: 'Analytics', icon: 'chart', capability: 'analytics.view', ready: true },
  { to: '/admin/admins', label: 'Admins & roles', icon: 'user', capability: 'admins.manage', ready: true },
  { to: '/admin/activity', label: 'Audit logs', icon: 'doc', capability: 'activity.view', ready: true },
  { to: '/admin/settings', label: 'System settings', icon: 'gear', capability: 'settings.manage', ready: true },
];

export function visibleNav(capabilities) {
  const caps = new Set(capabilities || []);
  return ADMIN_NAV.filter((item) => item.ready && caps.has(item.capability));
}
