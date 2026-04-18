export type WireloomTheme = 'default' | 'dark';
export type WireloomSecurityLevel = 'strict' | 'loose';

export interface WireloomConfig {
  theme: WireloomTheme;
  securityLevel: WireloomSecurityLevel;
}

const DEFAULT_CONFIG: Readonly<WireloomConfig> = Object.freeze({
  theme: 'default',
  securityLevel: 'strict',
});

let currentConfig: WireloomConfig = { ...DEFAULT_CONFIG };

export function mergeConfig(partial: Partial<WireloomConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}

export function getConfig(): WireloomConfig {
  return { ...currentConfig };
}

export function resetConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}
