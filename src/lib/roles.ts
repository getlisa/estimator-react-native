/**
 * Who counts as a company admin in the UI.
 *
 * The backend's user_role enum is { service_manager | admin | technician }, and a service manager
 * administers company settings just as an admin does (product decision 2026-09-04). This app
 * previously recognised only 'admin', which hid Configurations and the Connections card from
 * service managers — the reason the Connections card was briefly made visible to everyone.
 *
 * Mirrors isAdminRole in copilot-server/src/api/middlewares/auth.ts, which is what actually
 * enforces it; this is only for showing and hiding controls.
 */
export const ADMIN_ROLES = ['admin', 'service_manager'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const isAdminRole = (role: string | undefined | null): boolean =>
  !!role && (ADMIN_ROLES as readonly string[]).includes(role);
