export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const standardDeviation = (values) => {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

export const weightedChoice = (choices) => {
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (total <= 0) return choices[0]?.value;
  let threshold = Math.random() * total;
  for (const choice of choices) {
    threshold -= choice.weight;
    if (threshold <= 0) return choice.value;
  }
  return choices[choices.length - 1]?.value;
};

export const randomBetween = (min, max) => min + Math.random() * (max - min);

export const toIso = (timestamp = Date.now()) => new Date(timestamp).toISOString();

export const makeId = (prefix = "evt") => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

export const safeJsonParse = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const hashString = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};
