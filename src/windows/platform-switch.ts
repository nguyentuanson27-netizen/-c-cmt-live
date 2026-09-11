import type { Platform } from "../platform";

export type PlatformSwitchActions = {
  closeFacebookSources: () => void;
  closeSingleSource: () => void;
};

export function preparePlatformSwitch(
  incomingPlatform: Platform,
  actions: PlatformSwitchActions,
): void {
  if (incomingPlatform === "facebook") {
    actions.closeSingleSource();
  } else {
    actions.closeFacebookSources();
    actions.closeSingleSource();
  }
}
