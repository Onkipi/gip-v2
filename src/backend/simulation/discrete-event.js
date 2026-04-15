import { scenarioMultipliers } from "../config.js";
import { average, clamp } from "../utils.js";

const nodeKey = (event) => `${event.region}::${event.category}`;

export const buildDynamicEventSimulation = ({ events, scenario }) => {
  const recent = [...events.slice(0, 80)].reverse();
  const factor = scenarioMultipliers[scenario] || 1;

  const nodeStats = new Map();
  const edgeStats = new Map();

  for (let i = 0; i < recent.length; i += 1) {
    const current = recent[i];
    const currentKey = nodeKey(current);

    const existingNode = nodeStats.get(currentKey) || {
      id: currentKey,
      region: current.region,
      category: current.category,
      count: 0,
      impacts: []
    };

    existingNode.count += 1;
    existingNode.impacts.push(current.impact_score);
    nodeStats.set(currentKey, existingNode);

    if (i === 0) continue;

    const previous = recent[i - 1];
    const previousKey = nodeKey(previous);
    const edgeKey = `${previousKey}=>${currentKey}`;
    const chainIntensity = (current.impact_score + previous.impact_score) / 2;
    const weight = clamp(chainIntensity * factor * (current.sentiment < 0 ? 1.15 : 0.92), 1, 180);

    const existingEdge = edgeStats.get(edgeKey) || {
      source: previousKey,
      target: currentKey,
      transitions: 0,
      totalWeight: 0
    };

    existingEdge.transitions += 1;
    existingEdge.totalWeight += weight;
    edgeStats.set(edgeKey, existingEdge);
  }

  const nodes = Array.from(nodeStats.values()).map((node) => ({
    id: node.id,
    label: `${node.region} / ${node.category}`,
    region: node.region,
    category: node.category,
    count: node.count,
    avgImpact: Number(average(node.impacts).toFixed(2))
  }));

  const edges = Array.from(edgeStats.values())
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      transitions: edge.transitions,
      weight: Number(edge.totalWeight.toFixed(2))
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 36);

  const outgoingTotals = new Map();
  for (const edge of edges) {
    outgoingTotals.set(edge.source, (outgoingTotals.get(edge.source) || 0) + edge.weight);
  }

  const chains = edges.slice(0, 12).map((edge, index) => {
    const fromNode = nodes.find((node) => node.id === edge.source);
    const toNode = nodes.find((node) => node.id === edge.target);
    const total = outgoingTotals.get(edge.source) || edge.weight;
    const probability = clamp((edge.weight / total) * 100 * factor, 1, 99);

    return {
      id: `chain_${index}`,
      from: fromNode?.label || edge.source,
      to: toNode?.label || edge.target,
      probability: Number(probability.toFixed(2)),
      next_eta_min: Math.max(5, Math.round(55 - probability / 2))
    };
  });

  return {
    timestamp: new Date().toISOString(),
    scenario,
    graph: {
      nodes,
      edges
    },
    chains
  };
};
