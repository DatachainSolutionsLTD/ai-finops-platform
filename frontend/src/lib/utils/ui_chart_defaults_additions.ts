// Additional chart/UI helpers that augment the core chart-defaults module.

/**
 * Invert a RAG status string for display contexts where the semantic
 * direction is reversed (e.g. cost ↑ = bad).
 */
export const inverseStatus = (status: string): string => {
  const map: Record<string, string> = {
    Healthy: 'Critical',
    Critical: 'Healthy',
    Warning: 'Warning',
    Informational: 'Informational',
  };
  return map[status] ?? status;
};
