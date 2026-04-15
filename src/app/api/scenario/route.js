import { getRealtimeEngine } from "@/backend/engine-registry";
import { snapshotStore } from "@/backend/snapshot";

export const runtime = "nodejs";

const allowedScenarios = new Set(["baseline", "crisis", "extreme"]);

export async function GET() {
  return Response.json({
    scenario: snapshotStore.getSnapshot().scenario,
    options: Array.from(allowedScenarios)
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const scenario = body?.scenario;

  if (!allowedScenarios.has(scenario)) {
    return Response.json(
      {
        success: false,
        message: "Invalid scenario value"
      },
      { status: 400 }
    );
  }

  const engine = getRealtimeEngine();
  if (engine) {
    const success = await engine.setScenario(scenario);
    return Response.json({
      success,
      scenario: engine.getScenario()
    });
  }

  snapshotStore.setScenario(scenario);
  return Response.json({
    success: true,
    scenario
  });
}
