import type { PodMemberDTO, QuestionDTO, SocraticHint } from '@syncpod/shared';

export const DEMO_FOCUS_SECONDS = 60;
export const DEMO_BREAK_SECONDS = 20;
export const DEMO_MAX_ROUNDS = 4;

// Fixed deterministic delays (ms) for semifinal prototype video reproducibility (D19)
export const DEMO_MATCH_SCHEDULE_MS = [1200, 2600, 4200] as const;
export const DEMO_FALLBACK_TTL_MS = 60_000;
export const DEMO_GEMINI_DELAY_MS = 650;
export const DEMO_BOT_JOIN_STEP_MS = 900;
export const TYPING_IDLE_RESET_MS = 5000;

export const DEMO_CURRENT_USER = {
  userId: 'user-rizqi',
  name: 'Rizqi Pratama',
  universityName: 'ITATS',
} as const;

export const DEMO_SIMULATED_PEERS: readonly PodMemberDTO[] = [
  {
    userId: 'simulasi-1',
    name: 'Rifqi Hidayat',
    universityName: 'ITATS',
    role: 'MEMBER',
    status: 'TAKING_NOTES',
    isSimulated: true,
    focusedSec: 120,
  },
  {
    userId: 'simulasi-2',
    name: 'Farhan Ramadhan',
    universityName: 'ITATS',
    role: 'MEMBER',
    status: 'IN_FOCUS',
    isSimulated: true,
    focusedSec: 120,
  },
  {
    userId: 'simulasi-3',
    name: 'Rivan Alamsyah',
    universityName: 'ITATS',
    role: 'MEMBER',
    status: 'ASKING_GEMINI',
    isSimulated: true,
    focusedSec: 105,
  },
];

export const DEMO_INITIAL_NOTES = `# Tujuan sesi
- Implement priority queue
- Bandingkan Dijkstra dan Bellman-Ford

\`\`\`cpp
struct Node { int v, w; };
\`\`\`
`;

export const DEMO_MODULE_DIJKSTRA = {
  id: 'mod-dijkstra',
  title: 'Traversal Graf dan Dijkstra',
  path: ['Struktur Data', 'Graf', 'Traversal Graf dan Dijkstra'],
};

export function buildModuleInitialNotes(moduleTitle: string): string {
  if (moduleTitle === DEMO_MODULE_DIJKSTRA.title) {
    return DEMO_INITIAL_NOTES;
  }
  return `# Tujuan sesi — ${moduleTitle}
- Rumuskan bagian konsep yang paling membingungkan
- Catat contoh soal atau edge case yang gagal
`;
}

export function createDemoSeedQuestion(
  podId: string,
  createdAt: number,
  moduleId = DEMO_MODULE_DIJKSTRA.id,
  moduleTitle = DEMO_MODULE_DIJKSTRA.title,
): QuestionDTO {
  if (moduleId === DEMO_MODULE_DIJKSTRA.id) {
    return {
      id: 'q-042-1',
      podId,
      authorId: 'simulasi-3',
      authorName: 'Rivan Alamsyah',
      text: 'Bagaimana merepresentasikan edge berbobot negatif?',
      aiHint: null,
      resolved: false,
      createdAt,
    };
  }

  return {
    id: 'q-042-1',
    podId,
    authorId: 'simulasi-3',
    authorName: 'Rivan Alamsyah',
    text: `Apa syarat utama yang sering terlewat pada materi ${moduleTitle}?`,
    aiHint: null,
    resolved: false,
    createdAt,
  };
}

export function buildDeterministicSocraticHint(questionText: string): SocraticHint {
  const lower = questionText.toLowerCase();

  if (lower.includes('negatif') || lower.includes('dijkstra') || lower.includes('bellman')) {
    return {
      concept:
        'Asumsi greedy Dijkstra bergantung pada biaya jalur yang tidak pernah turun saat menambah edge.',
      guidingQuestions: [
        'Mengapa simpul yang sudah dikeluarkan dari priority queue pada Dijkstra dianggap memiliki jarak final?',
        'Apa yang terjadi pada asumsi tersebut jika sebuah edge berikutnya memiliki bobot negatif?',
        'Kondisi struktur data apa yang berubah antara satu langkah greedy dan relaksasi berulang pada Bellman-Ford?',
      ],
      analogy:
        'Bayangkan menghitung tarif tol tercepat saat semua gerbang selalu menambah biaya. Begitu ada gerbang yang justru memberi uang kembali, rute yang terlihat mahal di awal bisa berubah menjadi paling murah setelah dilewati.',
      docHint: {
        source: 'CP-Algorithms — Shortest Paths',
        searchFor: 'Dijkstra negative weights limitation vs Bellman-Ford relaxation',
      },
    };
  }

  return {
    concept: 'Memecah invariant masalah menjadi kasus dasar dan langkah transisi yang bisa diverifikasi.',
    guidingQuestions: [
      'Kondisi invariant apa yang harus tetap benar sebelum dan sesudah satu langkah proses dijalankan?',
      'Input uji terkecil atau kasus tepi apa yang paling cepat mematahkan asumsi awalmu?',
      'Bagian mana pada catatan bersama yang perlu disepakati sebelum kamu mencoba implementasi ulang?',
    ],
    analogy:
      'Seperti memeriksa jembatan per ruas: kamu tidak perlu menyeberangi seluruh jembatan untuk tahu baut mana yang longgar, cukup uji satu sambungan yang menanggung beban utama.',
    docHint: {
      source: 'MIT OpenCourseWare — Introduction to Algorithms',
      searchFor: 'loop invariant correctness proof',
    },
  };
}

