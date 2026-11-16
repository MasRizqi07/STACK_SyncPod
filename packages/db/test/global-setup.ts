import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function loadEnvFallback() {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
      break;
    }
  }
}

export async function setup() {
  loadEnvFallback();
  const baseDbUrl =
    process.env.DATABASE_URL || 'postgresql://syncpod:syncpod@localhost:5432/syncpod?schema=public';

  const u = new URL(baseDbUrl);
  u.pathname = '/syncpod_test';
  const testDbUrl = process.env.DATABASE_URL_TEST || u.toString();
  process.env.DATABASE_URL = testDbUrl;

  try {
    execSync('pnpm prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'pipe',
    });
  } catch {
    try {
      const adminUrlObj = new URL(baseDbUrl);
      adminUrlObj.pathname = '/postgres';
      const adminPrisma = new PrismaClient({
        datasources: { db: { url: adminUrlObj.toString() } },
      });
      await adminPrisma.$executeRawUnsafe('CREATE DATABASE syncpod_test;');
      await adminPrisma.$disconnect();
    } catch {
      // Ignored
    }

    execSync('pnpm prisma migrate deploy', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: 'pipe',
    });
  }

  const testPrisma = new PrismaClient({
    datasources: { db: { url: testDbUrl } },
  });
  try {
    await testPrisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Endorsement", "Question", "PodMember", "MatchRequest", "SprintPod", "Module", "Course", "User" CASCADE;',
    );
  } catch {
    // Ignored
  } finally {
    await testPrisma.$disconnect();
  }
}

export async function teardown() {
  // Teardown hook
}
