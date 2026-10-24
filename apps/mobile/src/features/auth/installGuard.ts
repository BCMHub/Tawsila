import type { InstallGuard } from './AuthProvider';
type MarkerStore = { read(): Promise<string | null>; write(value: string): Promise<void> };
export function createInstallGuard(markerStore: MarkerStore): InstallGuard & { markVerified(): Promise<void> } {
  return {
    async isFreshInstall() { try { return await markerStore.read() !== 'verified-v1'; } catch { return true; } },
    async markVerified() { await markerStore.write('verified-v1'); },
  };
}
export const installGuard = createInstallGuard({
  async read() {
    const { File, Paths } = await import('expo-file-system');
    const file = new File(Paths.document, 'install-session-guard');
    return file.exists ? file.text() : null;
  },
  async write(value) {
    const { File, Paths } = await import('expo-file-system');
    new File(Paths.document, 'install-session-guard').write(value);
  },
});
