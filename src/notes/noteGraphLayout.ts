import { parseNoteLinks, resolveNoteTitleSlug } from "./noteLinkParsing";
import type { Note } from "./noteTypes";

export type GraphNode = {
  id: string;
  title: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
};

export type GraphEdge = {
  sourceId: string;
  targetId: string;
};

export type GraphModel = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const REPULSION_STRENGTH = 1800;
const SPRING_LENGTH = 90;
const SPRING_STRENGTH = 0.02;
const CENTERING_STRENGTH = 0.012;
const DAMPING = 0.86;

export function buildNoteGraphModel(notes: Note[]): GraphModel {
  const slugToNoteId = new Map<string, string>();

  for (const note of notes) {
    slugToNoteId.set(resolveNoteTitleSlug(note.title), note.id);
  }

  const degrees = new Map<string, number>();
  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const note of notes) {
    const references = parseNoteLinks(note.content).filter(
      (reference) => reference.targetType === "note",
    );

    for (const reference of references) {
      const targetId = slugToNoteId.get(reference.targetKey);

      if (!targetId || targetId === note.id) {
        continue;
      }

      const key = [note.id, targetId].sort().join("::");

      if (edgeKeys.has(key)) {
        continue;
      }

      edgeKeys.add(key);
      edges.push({ sourceId: note.id, targetId });
      degrees.set(note.id, (degrees.get(note.id) ?? 0) + 1);
      degrees.set(targetId, (degrees.get(targetId) ?? 0) + 1);
    }
  }

  const nodes: GraphNode[] = notes.map((note, index) => {
    const angle = (index / Math.max(notes.length, 1)) * Math.PI * 2;

    return {
      degree: degrees.get(note.id) ?? 0,
      id: note.id,
      title: note.title,
      vx: 0,
      vy: 0,
      x: Math.cos(angle) * 140,
      y: Math.sin(angle) * 140,
    };
  });

  return { edges, nodes };
}

export function filterToLocalGraph(model: GraphModel, focusNoteId: string): GraphModel {
  const neighborIds = new Set<string>([focusNoteId]);

  for (const edge of model.edges) {
    if (edge.sourceId === focusNoteId) {
      neighborIds.add(edge.targetId);
    } else if (edge.targetId === focusNoteId) {
      neighborIds.add(edge.sourceId);
    }
  }

  return {
    edges: model.edges.filter(
      (edge) => neighborIds.has(edge.sourceId) && neighborIds.has(edge.targetId),
    ),
    nodes: model.nodes.filter((node) => neighborIds.has(node.id)),
  };
}

export function stepGraphSimulation(nodes: GraphNode[], edges: GraphEdge[]): void {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const distanceSquared = Math.max(dx * dx + dy * dy, 1);
      const distance = Math.sqrt(distanceSquared);
      const force = REPULSION_STRENGTH / distanceSquared;
      const forceX = (dx / distance) * force;
      const forceY = (dy / distance) * force;

      nodeA.vx += forceX;
      nodeA.vy += forceY;
      nodeB.vx -= forceX;
      nodeB.vy -= forceY;
    }
  }

  for (const edge of edges) {
    const source = nodeById.get(edge.sourceId);
    const target = nodeById.get(edge.targetId);

    if (!source || !target) {
      continue;
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const displacement = distance - SPRING_LENGTH;
    const forceX = (dx / distance) * displacement * SPRING_STRENGTH;
    const forceY = (dy / distance) * displacement * SPRING_STRENGTH;

    source.vx += forceX;
    source.vy += forceY;
    target.vx -= forceX;
    target.vy -= forceY;
  }

  for (const node of nodes) {
    if (node.fixed) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx -= node.x * CENTERING_STRENGTH;
    node.vy -= node.y * CENTERING_STRENGTH;
    node.vx *= DAMPING;
    node.vy *= DAMPING;
    node.x += node.vx;
    node.y += node.vy;
  }
}
