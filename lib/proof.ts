// What "Log it" should do, given which pods are selected.
//
// Two different rules can demand a live in-app photo, and they behave
// differently on purpose:
//
//  - STAKES: a live photo is what lets a log count toward the wager. If the
//    camera genuinely can't open, the member can still log — the log just
//    won't count toward the stake (so a phone quirk never blocks a real
//    workout).
//  - PHOTO RULE (a pod's own rule, chosen when it was created): the photo IS
//    the rule, so there is no unverified fallback. If the camera can't open,
//    they can't log to that pod until it can — or they deselect that pod.
//    (A fallback would be a loophole in exactly the rule the pod chose.)
//
// When both apply, the stricter one wins.

export type PodSet = { has(id: string): boolean };

export type LogGate = {
  requiresProof: boolean; // a selected pod's own rule demands a live photo
  requiresStakesPhoto: boolean; // a selected pod has stakes running
  requiresLive: boolean; // either of the above
  action: "camera" | "save"; // what tapping the button does right now
  button: "log" | "camera" | "unverified"; // which label the button shows
};

export function logGate(i: {
  selectedPods: string[];
  stakedPodIds: PodSet;
  proofPodIds: PodSet;
  liveVerified: boolean;
  cameraFailed: boolean;
}): LogGate {
  const requiresProof = i.selectedPods.some((id) => i.proofPodIds.has(id));
  const requiresStakesPhoto = i.selectedPods.some((id) => i.stakedPodIds.has(id));
  const requiresLive = requiresProof || requiresStakesPhoto;

  // The pod's own rule: never save without a live photo, whatever happened to
  // the camera. A failed camera just means "try again".
  if (requiresProof && !i.liveVerified) {
    return { requiresProof, requiresStakesPhoto, requiresLive, action: "camera", button: "camera" };
  }
  if (requiresStakesPhoto && !i.liveVerified) {
    return i.cameraFailed
      ? { requiresProof, requiresStakesPhoto, requiresLive, action: "save", button: "unverified" }
      : { requiresProof, requiresStakesPhoto, requiresLive, action: "camera", button: "camera" };
  }
  return { requiresProof, requiresStakesPhoto, requiresLive, action: "save", button: "log" };
}
