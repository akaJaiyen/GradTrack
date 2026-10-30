export const TYPHOON_CONSENT_VERSION = "typhoon-v1";

export function hasTyphoonConsent(workspace: { consented_at?: string | null; consent_version?: string | null } | null | undefined) {
  return Boolean(workspace?.consented_at && workspace.consent_version === TYPHOON_CONSENT_VERSION);
}
