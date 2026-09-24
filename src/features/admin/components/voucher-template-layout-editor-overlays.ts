export function getVoucherEditorOverlayState({ showGuides, showBleed, isInteracting }: { showGuides: boolean; showBleed: boolean; isInteracting: boolean }) {
  return {
    guidesVisible: showGuides,
    guidesEmphasized: showGuides && isInteracting,
    bleedVisible: showBleed,
  };
}
