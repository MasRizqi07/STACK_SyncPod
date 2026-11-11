export interface DatabaseConfig {
  url: string;
}

export function readDatabaseConfig(
  env: Record<string, string | undefined> = process.env,
): DatabaseConfig {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  return { url };
}

