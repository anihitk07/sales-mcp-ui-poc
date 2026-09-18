import { InvocationContext } from "@azure/functions";
import { IdentityScope } from "./salesTypes";

const TRUSTED_KEYS = [
  "clientPrincipalId",
  "clientprincipalid",
  "x-ms-client-principal-id",
  "xMsClientPrincipalId",
];

export function resolveIdentity(context: InvocationContext): IdentityScope {
  const metadata = context.triggerMetadata || {};
  for (const key of TRUSTED_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return {
        key: `entra:${value.trim()}`,
        label: "Authenticated M365/Entra identity",
        proven: true,
      };
    }
  }
  const fallback = process.env.POC_IDENTITY_FALLBACK || "poc-authenticated-identity-unavailable";
  return {
    key: `fallback:${fallback}`,
    label: `PoC identity fallback (${fallback})`,
    proven: false,
  };
}
