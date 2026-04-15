export const getPriorityLevel = (event) => {
  const impact = Number(event?.impact_score || 0);
  const sentiment = Number(event?.sentiment || 0);

  if (impact >= 76 || sentiment <= -0.5) return "high";
  if (impact >= 52 || sentiment <= -0.2) return "medium";
  return "normal";
};

export const priorityStyles = {
  high: {
    label: "High",
    color: "#dc2626",
    badge: "bg-red-100 text-red-700",
    border: "border-red-300",
    marker: "#ef4444"
  },
  medium: {
    label: "Medium",
    color: "#d97706",
    badge: "bg-amber-100 text-amber-700",
    border: "border-amber-300",
    marker: "#f59e0b"
  },
  normal: {
    label: "Normal",
    color: "#16a34a",
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-300",
    marker: "#22c55e"
  }
};

export const formatEventTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export const formatEventAge = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(deltaMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export const matchesSearch = (event, query) => {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    event.headline?.toLowerCase().includes(q) ||
    event.summary?.toLowerCase().includes(q) ||
    event.region?.toLowerCase().includes(q) ||
    event.location_label?.toLowerCase().includes(q) ||
    event.category?.toLowerCase().includes(q)
  );
};
