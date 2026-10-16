// face-profiles.js - engine-specific persisted artistic profiles (pure code). The two engines place landmarks slightly differently, so the face-dependent
// etching settings (touch per subject, region strengths, flow, outlines) are remembered PER ENGINE: switching engine stores the current values under the old
// engine and restores the values last used with the new one (first time: the current values are kept as its starting profile). Persisted in params.engineProfiles.
export const PROFILE_KEYS = ['htKinds', 'htFlow', 'htContour', 'htRegSkin', 'htRegHair', 'htRegEyes', 'htRegBrows', 'htRegNose', 'htRegLips', 'htRegCheek'];
export const captureProfile = (p) => Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]]));
/** Returns a NEW params object with faceEngine = to, engineProfiles updated and the target engine's profile applied. */
export function switchEngine(p, to) {
  const from = p.faceEngine || 'legacy'; if (from === to) return p;
  const profiles = { ...(p.engineProfiles || {}), [from]: captureProfile(p) };
  const next = { ...p, faceEngine: to, engineProfiles: profiles };
  if (profiles[to]) { for (const k of PROFILE_KEYS) if (profiles[to][k] != null) next[k] = profiles[to][k]; } else profiles[to] = captureProfile(next); // first use: start from the current values
  return next;
}
/** Keeps the stored profile of the ACTIVE engine in step with live edits (call before saving settings). */
export function syncActiveProfile(p) { const e = p.faceEngine || 'legacy'; p.engineProfiles = { ...(p.engineProfiles || {}), [e]: captureProfile(p) }; return p; }
