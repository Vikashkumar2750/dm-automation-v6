export type PublishingFeature = "create_post" | "calendar";
export type PublishingMode = "enabled" | "hidden" | "coming_soon";

export function publishingMode(flags: Record<string, unknown>, feature: PublishingFeature): PublishingMode {
  if (flags[`${feature}_coming_soon`] === true) return "coming_soon";
  return flags[`${feature}_enabled`] === false ? "hidden" : "enabled";
}

export function publishingModeFlags(feature: PublishingFeature, mode: PublishingMode): Record<string, boolean> {
  return { [`${feature}_enabled`]: mode === "enabled", [`${feature}_coming_soon`]: mode === "coming_soon" };
}