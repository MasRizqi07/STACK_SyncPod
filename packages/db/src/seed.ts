import { MODULE_CATALOG } from '@syncpod/shared';
import { db } from './index.js';

export const DEMO_USERS = [
  {
    email: 'demo-1@demo.syncpod.local',
    name: 'Rizqi Pratama',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
  {
    email: 'demo-2@demo.syncpod.local',
    name: 'Rifqi Hidayat',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
  {
    email: 'demo-3@demo.syncpod.local',
    name: 'Farhan Ramadhan',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
  {
    email: 'demo-4@demo.syncpod.local',
    name: 'Rivan Alamsyah',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
] as const;

export const BOT_USERS = [
  {
    email: 'simulasi-1@bot.syncpod.local',
    name: 'Simulasi 1 (Bot)',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
  {
    email: 'simulasi-2@bot.syncpod.local',
    name: 'Simulasi 2 (Bot)',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
  {
    email: 'simulasi-3@bot.syncpod.local',
    name: 'Simulasi 3 (Bot)',
    universityName: 'Institut Teknologi Adhi Tama Surabaya',
  },
] as const;

export async function seed(): Promise<{
  courses: number;
  modules: number;
  users: number;
}> {
  // 1. Seed courses & modules from MODULE_CATALOG (D26)
  for (const courseNode of MODULE_CATALOG) {
    const course = await db.course.upsert({
      where: { code: courseNode.courseCode },
      update: {
        title: courseNode.title,
      },
      create: {
        id: courseNode.id,
        code: courseNode.courseCode,
        title: courseNode.title,
      },
    });

    if (courseNode.children) {
      for (const topicNode of courseNode.children) {
        await db.module.upsert({
          where: { id: topicNode.id },
          update: {
            title: topicNode.title,
            courseId: course.id,
            parentId: null,
            isLeaf: false,
          },
          create: {
            id: topicNode.id,
            title: topicNode.title,
            courseId: course.id,
            parentId: null,
            isLeaf: false,
          },
        });

        if (topicNode.children) {
          for (const leafNode of topicNode.children) {
            await db.module.upsert({
              where: { id: leafNode.id },
              update: {
                title: leafNode.title,
                courseId: course.id,
                parentId: topicNode.id,
                isLeaf: true,
              },
              create: {
                id: leafNode.id,
                title: leafNode.title,
                courseId: course.id,
                parentId: topicNode.id,
                isLeaf: true,
              },
            });
          }
        }
      }
    }
  }

  // 2. Seed 4 fictional demo accounts (aligned with demo constants)
  for (const demoUser of DEMO_USERS) {
    await db.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        universityName: demoUser.universityName,
      },
      create: {
        email: demoUser.email,
        name: demoUser.name,
        universityName: demoUser.universityName,
      },
    });
  }

  // 3. Seed 3 bot users (D8)
  for (const botUser of BOT_USERS) {
    await db.user.upsert({
      where: { email: botUser.email },
      update: {
        name: botUser.name,
        universityName: botUser.universityName,
      },
      create: {
        email: botUser.email,
        name: botUser.name,
        universityName: botUser.universityName,
      },
    });
  }

  const coursesCount = await db.course.count();
  const modulesCount = await db.module.count();
  const usersCount = await db.user.count();

  return {
    courses: coursesCount,
    modules: modulesCount,
    users: usersCount,
  };
}

async function main() {
  const counts = await seed();
  console.log(`[seed] Completed successfully:`);
  console.log(`  Courses : ${counts.courses}`);
  console.log(`  Modules : ${counts.modules}`);
  console.log(`  Users   : ${counts.users}`);
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  main()
    .catch((err) => {
      console.error('[seed] Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
