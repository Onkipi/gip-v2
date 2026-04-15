const registry = globalThis.__INTEL_ENGINE_REGISTRY__ || {
  engine: null
};

if (!globalThis.__INTEL_ENGINE_REGISTRY__) {
  globalThis.__INTEL_ENGINE_REGISTRY__ = registry;
}

export const setRealtimeEngine = (engine) => {
  registry.engine = engine;
};

export const getRealtimeEngine = () => registry.engine;
