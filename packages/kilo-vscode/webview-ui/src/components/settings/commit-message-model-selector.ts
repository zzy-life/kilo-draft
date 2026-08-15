/**
 * Resolve the commit message (provider, model) pair to the dropdown's value.
 * Returns `null` when either side is unset so the selector renders the "Not
 * set" (clear) state via `allowClear`. The backend resolves unset → the
 * configured commit_message.model → the default small model separately.
 */
export function getCommitMessageSelection(provider?: string, modelID?: string) {
  if (!provider || !modelID) return null
  return { providerID: provider, modelID }
}
