import type { UserRole } from "@/lib/domain/types";

const permissions: Record<UserRole, string[]> = {
  ADMIN: ["*"],
  OWNER: ["*"],
  ADMIN_STAFF: ["trips:create", "trips:update", "clients:manage", "expenses:create", "incomes:create"],
  DRIVER: ["trips:create", "trips:own"]
};

export function can(role: UserRole, permission: string) {
  const granted = permissions[role] ?? [];
  return granted.includes("*") || granted.includes(permission);
}

export function assertCan(role: UserRole, permission: string) {
  if (!can(role, permission)) {
    throw new Error(`El rol ${role} no tiene permiso ${permission}`);
  }
}
