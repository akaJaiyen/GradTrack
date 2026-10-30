import { describe, expect, it } from "vitest";
import { hasTyphoonConsent } from "@/lib/consent";

describe("Typhoon consent version", () => {
  it("requires a new consent when only legacy Gemini consent exists", () => {
    expect(hasTyphoonConsent({ consented_at: "2026-01-01T00:00:00Z", consent_version: "gemini-v1" })).toBe(false);
  });

  it("allows processing only after the current consent version is recorded", () => {
    expect(hasTyphoonConsent({ consented_at: "2026-01-01T00:00:00Z", consent_version: "typhoon-v1" })).toBe(true);
    expect(hasTyphoonConsent({ consented_at: null, consent_version: "typhoon-v1" })).toBe(false);
  });
});
