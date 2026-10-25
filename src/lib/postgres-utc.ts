/** Startup parametr platí pro každé nové spojení poolu, ještě před prvním SQL. */
export function withUtcPostgresTimezone(connectionString: string) {
  const url = new URL(connectionString);
  // pg dává options z URL přednost před PoolConfig.options. UTC proto musí být
  // poslední i v URL, která už obsahuje jiné startup parametry.
  const options = url.searchParams.get("options")?.trim();
  url.searchParams.set("options", `${options ? `${options} ` : ""}-c timezone=UTC`);
  return url.toString();
}
