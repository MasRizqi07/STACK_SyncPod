export interface DemoAccountFixture {
  readonly email: string;
  readonly name: string;
  readonly universityName: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccountFixture[] = [
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

export const BOT_ACCOUNTS: readonly DemoAccountFixture[] = [
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

export const DEMO_EMAIL_SET: ReadonlySet<string> = new Set(
  DEMO_ACCOUNTS.map((account) => account.email.toLowerCase()),
);

export const BOT_EMAIL_SET: ReadonlySet<string> = new Set(
  BOT_ACCOUNTS.map((bot) => bot.email.toLowerCase()),
);
