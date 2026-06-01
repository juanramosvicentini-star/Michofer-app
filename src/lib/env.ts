export function hasDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) return false;
  if (value.includes("your-project")) return false;
  if (value.includes("password@db.")) return false;

  return true;
}
