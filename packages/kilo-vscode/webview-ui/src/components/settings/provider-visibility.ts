import type { Provider } from "../../types/messages"
import { KILO_PROVIDER_ID, createKiloFallbackProvider } from "../../../../src/shared/provider-model"

export function providersWithKiloFallback(providers: Record<string, Provider>): Record<string, Provider> {
  if (providers[KILO_PROVIDER_ID]) return providers
  return { [KILO_PROVIDER_ID]: createKiloFallbackProvider(), ...providers }
}

export function disabledProviderOptions(providers: Record<string, Provider>, disabled: string[]) {
  const current = new Set(disabled)
  return Object.values(providers)
    .filter((item) => !current.has(item.id))
    .map((item) => ({ value: item.id, label: item.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

