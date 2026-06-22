/**
 * Ad provider configuration — all values read from environment variables.
 * Set VITE_AD_MODE=live to activate real ads.
 *
 * Adsterra zones for rasmis1235.tech:
 *   Social Bar  (29749796) → VITE_ADSTERRA_SOCIALBAR_SRC
 *   Popunder    (29749794) → VITE_ADSTERRA_POPUNDER_SRC
 *   Smartlink   (29749797) → VITE_ADSTERRA_SMARTLINK_URL  (used as video player iframe src)
 *   Native Banner (29749795) → VITE_ADSTERRA_NATIVE_SRC
 */

export const AD_MODE = import.meta.env.VITE_AD_MODE === 'live';

export const AD_SCRIPTS = {
  // Adsterra — full script/URL values from Adsterra publisher dashboard
  socialBar:  import.meta.env.VITE_ADSTERRA_SOCIALBAR_SRC  || '',
  popunder:   import.meta.env.VITE_ADSTERRA_POPUNDER_SRC   || '',
  smartlink:  import.meta.env.VITE_ADSTERRA_SMARTLINK_URL  || '',
  native:     import.meta.env.VITE_ADSTERRA_NATIVE_SRC     || '',

  // Other networks (add zone IDs/URLs when you sign up)
  popads:     import.meta.env.VITE_POPADS_ID               || '',
  hilltopads: import.meta.env.VITE_HILLTOPADS_ID           || '',
  clickadu:   import.meta.env.VITE_CLICKADU_ZONE           || '',
  monetag1:   import.meta.env.VITE_MONETAG_ZONE_1          || '',
  monetag2:   import.meta.env.VITE_MONETAG_ZONE_2          || '',
} as const;

// Legacy export kept for BannerAdSlot slot-type switching
export const AD_KEYS = AD_SCRIPTS;
export type ProviderName = keyof typeof AD_SCRIPTS;
export const isActive = (p: ProviderName) => AD_MODE && !!AD_SCRIPTS[p];
