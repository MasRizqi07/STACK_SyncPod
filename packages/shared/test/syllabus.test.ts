import { describe, expect, it } from 'vitest';
import {
  MODULE_CATALOG,
  filterModuleCatalog,
  findModuleNodeById,
  getLeafModules,
  type ModuleTreeNode,
} from '../src/index.js';

function collectDepthsAndIds(
  nodes: readonly ModuleTreeNode[],
  depth = 1,
  seen = new Set<string>(),
): { maxDepth: number; leafDepths: number[] } {
  let maxDepth = depth;
  const leafDepths: number[] = [];

  for (const node of nodes) {
    expect(seen.has(node.id)).toBe(false);
    seen.add(node.id);
    expect(node.path.length).toBe(depth);

    if (node.isLeaf) {
      expect(node.children ?? []).toHaveLength(0);
      leafDepths.push(depth);
    } else {
      expect((node.children ?? []).length).toBeGreaterThan(0);
      const child = collectDepthsAndIds(node.children ?? [], depth + 1, seen);
      maxDepth = Math.max(maxDepth, child.maxDepth);
      leafDepths.push(...child.leafDepths);
    }
  }

  return { maxDepth, leafDepths };
}

describe('syllabus fixture (M8, PRD FR-1.3)', () => {
  it('provides at least 3 courses, 3 levels, and at least 8 leaf modules marked isLeaf', () => {
    expect(MODULE_CATALOG.length).toBeGreaterThanOrEqual(3);

    const { maxDepth, leafDepths } = collectDepthsAndIds(MODULE_CATALOG);
    expect(maxDepth).toBe(3);
    expect(leafDepths.every((d) => d === 3)).toBe(true);

    const leaves = getLeafModules();
    expect(leaves.length).toBeGreaterThanOrEqual(8);
    expect(leaves.every((leaf) => leaf.isLeaf)).toBe(true);
    expect(MODULE_CATALOG.every((course) => !course.isLeaf)).toBe(true);
  });

  it('resolves nodes by ID and filters matching leaf branches', () => {
    const dijkstra = findModuleNodeById('mod-dijkstra');
    expect(dijkstra?.isLeaf).toBe(true);
    expect(dijkstra?.path).toEqual(['Struktur Data', 'Graf', 'Traversal Graf dan Dijkstra']);

    const filtered = filterModuleCatalog('Dijkstra');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('course-if201');
  });
});
