export const ROLES = ['DRIVER', 'SUPPLIER', 'MECHANIC', 'TOW_DRIVER', 'DISPATCHER', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

/** Roles whose actions need an admin approval first. */
export const NEEDS_APPROVAL: Role[] = ['SUPPLIER', 'MECHANIC', 'TOW_DRIVER']

export const ROLE_HOME: Record<Role, string> = {
  DRIVER: '/app/driver',
  SUPPLIER: '/app/supplier',
  MECHANIC: '/app/mechanic',
  TOW_DRIVER: '/app/tow',
  DISPATCHER: '/app/dispatcher',
  ADMIN: '/app/admin',
}

export function homeFor(role: Role): string {
  return ROLE_HOME[role]
}
