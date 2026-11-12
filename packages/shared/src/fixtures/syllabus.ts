export interface ModuleTreeNode {
  id: string;
  courseCode: string;
  title: string;
  isLeaf: boolean;
  path: readonly string[];
  children?: readonly ModuleTreeNode[];
}

/**
 * Single-source 3-level ITATS syllabus taxonomy (M8, PRD FR-1.3).
 * Used by fake matchmaking in Phase 2b and Prisma seed in Phase 3.
 */
export const MODULE_CATALOG: readonly ModuleTreeNode[] = [
  {
    id: 'course-if201',
    courseCode: 'IF201',
    title: 'Struktur Data',
    isLeaf: false,
    path: ['Struktur Data'],
    children: [
      {
        id: 'topic-sd-graf',
        courseCode: 'IF201',
        title: 'Graf',
        isLeaf: false,
        path: ['Struktur Data', 'Graf'],
        children: [
          {
            id: 'mod-dijkstra',
            courseCode: 'IF201',
            title: 'Traversal Graf dan Dijkstra',
            isLeaf: true,
            path: ['Struktur Data', 'Graf', 'Traversal Graf dan Dijkstra'],
          },
          {
            id: 'mod-mst',
            courseCode: 'IF201',
            title: 'Minimum Spanning Tree (Kruskal & Prim)',
            isLeaf: true,
            path: ['Struktur Data', 'Graf', 'Minimum Spanning Tree (Kruskal & Prim)'],
          },
        ],
      },
      {
        id: 'topic-sd-tree',
        courseCode: 'IF201',
        title: 'Pohon Biner dan AVL',
        isLeaf: false,
        path: ['Struktur Data', 'Pohon Biner dan AVL'],
        children: [
          {
            id: 'mod-avl',
            courseCode: 'IF201',
            title: 'Rotasi dan Keseimbangan AVL Tree',
            isLeaf: true,
            path: ['Struktur Data', 'Pohon Biner dan AVL', 'Rotasi dan Keseimbangan AVL Tree'],
          },
        ],
      },
    ],
  },
  {
    id: 'course-ma202',
    courseCode: 'MA202',
    title: 'Aljabar Linier',
    isLeaf: false,
    path: ['Aljabar Linier'],
    children: [
      {
        id: 'topic-al-vektor',
        courseCode: 'MA202',
        title: 'Ruang Vektor',
        isLeaf: false,
        path: ['Aljabar Linier', 'Ruang Vektor'],
        children: [
          {
            id: 'mod-basis-dimensi',
            courseCode: 'MA202',
            title: 'Kebebasan Linier, Basis, dan Dimensi',
            isLeaf: true,
            path: ['Aljabar Linier', 'Ruang Vektor', 'Kebebasan Linier, Basis, dan Dimensi'],
          },
          {
            id: 'mod-eigen',
            courseCode: 'MA202',
            title: 'Nilai Eigen dan Vektor Eigen',
            isLeaf: true,
            path: ['Aljabar Linier', 'Ruang Vektor', 'Nilai Eigen dan Vektor Eigen'],
          },
        ],
      },
      {
        id: 'topic-al-transformasi',
        courseCode: 'MA202',
        title: 'Transformasi Linier',
        isLeaf: false,
        path: ['Aljabar Linier', 'Transformasi Linier'],
        children: [
          {
            id: 'mod-matriks-kernel',
            courseCode: 'MA202',
            title: 'Representasi Matriks dan Kernel',
            isLeaf: true,
            path: ['Aljabar Linier', 'Transformasi Linier', 'Representasi Matriks dan Kernel'],
          },
        ],
      },
    ],
  },
  {
    id: 'course-if304',
    courseCode: 'IF304',
    title: 'Sistem Operasi',
    isLeaf: false,
    path: ['Sistem Operasi'],
    children: [
      {
        id: 'topic-so-sinkronisasi',
        courseCode: 'IF304',
        title: 'Sinkronisasi Proses',
        isLeaf: false,
        path: ['Sistem Operasi', 'Sinkronisasi Proses'],
        children: [
          {
            id: 'mod-deadlock',
            courseCode: 'IF304',
            title: "Penanganan Deadlock dan Banker's Algorithm",
            isLeaf: true,
            path: [
              'Sistem Operasi',
              'Sinkronisasi Proses',
              "Penanganan Deadlock dan Banker's Algorithm",
            ],
          },
          {
            id: 'mod-semaphore',
            courseCode: 'IF304',
            title: 'Mutex, Semaphore, dan Producer-Consumer',
            isLeaf: true,
            path: [
              'Sistem Operasi',
              'Sinkronisasi Proses',
              'Mutex, Semaphore, dan Producer-Consumer',
            ],
          },
        ],
      },
      {
        id: 'topic-so-memori',
        courseCode: 'IF304',
        title: 'Manajemen Memori',
        isLeaf: false,
        path: ['Sistem Operasi', 'Manajemen Memori'],
        children: [
          {
            id: 'mod-paging',
            courseCode: 'IF304',
            title: 'Paging, TLB, dan Page Replacement',
            isLeaf: true,
            path: ['Sistem Operasi', 'Manajemen Memori', 'Paging, TLB, dan Page Replacement'],
          },
        ],
      },
    ],
  },
];

export function findModuleNodeById(
  moduleId: string,
  nodes: readonly ModuleTreeNode[] = MODULE_CATALOG,
): ModuleTreeNode | null {
  for (const node of nodes) {
    if (node.id === moduleId) {
      return node;
    }
    if (node.children) {
      const matched = findModuleNodeById(moduleId, node.children);
      if (matched) return matched;
    }
  }
  return null;
}

export function getLeafModules(
  nodes: readonly ModuleTreeNode[] = MODULE_CATALOG,
): ModuleTreeNode[] {
  const result: ModuleTreeNode[] = [];
  for (const node of nodes) {
    if (node.isLeaf) {
      result.push(node);
    } else if (node.children) {
      result.push(...getLeafModules(node.children));
    }
  }
  return result;
}

export function filterModuleCatalog(
  query: string,
  nodes: readonly ModuleTreeNode[] = MODULE_CATALOG,
): ModuleTreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...nodes];
  }

  const filtered: ModuleTreeNode[] = [];
  for (const node of nodes) {
    const selfMatches =
      node.title.toLowerCase().includes(normalized) ||
      node.courseCode.toLowerCase().includes(normalized);
    if (node.isLeaf) {
      if (selfMatches) {
        filtered.push(node);
      }
      continue;
    }

    const matchingChildren = node.children ? filterModuleCatalog(query, node.children) : [];
    if (matchingChildren.length > 0) {
      filtered.push({ ...node, children: matchingChildren });
    } else if (selfMatches && node.children) {
      filtered.push(node);
    }
  }
  return filtered;
}
