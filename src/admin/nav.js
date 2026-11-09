// Admin navigation (Phase 5.1). Each entry names the capability the server
// grants per role (backend/adminpanel/capabilities.py); entries the signed-in
// admin lacks are not shown. The server still checks every request.
// Modules arrive in Phase 6: flip `ready` to true as each one ships.
export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'chart', capability: 'dashboard.view', ready: true, end: true },
  { to: '/admin/users', label: 'Users', icon: 'user', capability: 'users.view', ready: false },
  { to: '/admin/startups', label: 'Startups', icon: 'flag', capability: 'startups.view', ready: false },
  { to: '/admin/investments', label: 'Investments', icon: 'coin', capability: 'investments.view', ready: false },
  { to: '/admin/collaborations', label: 'Collaborations', icon: 'handshake', capability: 'collaborations.view', ready: false },
  { to: '/admin/community', label: 'Community', icon: 'comment', capability: 'content.moderate', ready: false },
  { to: '/admin/reports', label: 'Reports', icon: 'flag', capability: 'reports.manage', ready: false },
  { to: '/admin/notifications', label: 'Announcements', icon: 'bell', capability: 'notifications.send', ready: false },
  { to: '/admin/analytics', label: 'Analytics', icon: 'chart', capability: 'analytics.view', ready: false },
  { to: '/admin/admins', label: 'Admins & roles', icon: 'user', capability: 'admins.manage', ready: false },
  { to: '/admin/activity', label: 'Activity log', icon: 'doc', capability: 'activity.view', ready: true },
  { to: '/admin/settings', label: 'System settings', icon: 'gear', capability: 'settings.manage', ready: false },
];

export function visibleNav(capabilities) {
  const caps = new Set(capabilities || []);
  return ADMIN_NAV.filter((item) => item.ready && caps.has(item.capability));
}
