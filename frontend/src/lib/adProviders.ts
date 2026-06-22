/**
 * Ad provider configuration.
 *
 * All keys are read from environment variables.
 * Set VITE_AD_MODE=live to activate real ads.
 *
 * Revenue model: platform keeps 80%, 20% paid to users as points.
 * All networks below pay CPM (per impression/view), NOT just per click.
 *
 * ─── HOW TO ADD KEYS ─────────────────────────────────────────────────
 * Create frontend/.env.local with:
 *
 *   VITE_AD_MODE=live
 *   VITE_ADSTERRA_KEY=a45c62cfce50064f417db1cba144fa9d
 *   VITE_POPADS_ID=your_popads_publisher_id
 *   VITE_HILLTOPADS_ID=your_hilltopads_zone_id
 *   VITE_CLICKADU_ZONE=your_clickadu_zone_id
 *   VITE_MONETAG_ZONE_1=your_monetag_zone_id_1
 *   VITE_MONETAG_ZONE_2=your_monetag_zone_id_2
 *
 * ─── NETWORK SUMMARY ─────────────────────────────────────────────────
 * Network       CPM India    GPT?   Signup  Integration
 * Adsterra      $0.30–1.50   ✅ Yes  Easy    Social Bar script
 * PopAds        $0.15–0.80   ✅ Yes  Easy    Pop-under (per page visit)
 * HilltopAds    $0.40–2.00   ✅ Yes  Easy    In-Page Push / Native
 * ClickAdu      $0.20–1.00   ✅ Yes  Easy    Push / Pop-under
 * Monetag       $0.50–3.00   ✅ Yes  Easy    In-Page Push / Native
 */

export const AD_MODE = import.meta.env.VITE_AD_MODE === 'live';

export const AD_KEYS = {
  adsterra:        import.meta.env.VITE_ADSTERRA_KEY         || '',
  adsterraDirect:  import.meta.env.VITE_ADSTERRA_DIRECT_URL  || '',
  popads:          import.meta.env.VITE_POPADS_ID            || '',
  hilltopads:      import.meta.env.VITE_HILLTOPADS_ID        || '',
  clickadu:        import.meta.env.VITE_CLICKADU_ZONE        || '',
  monetag1:        import.meta.env.VITE_MONETAG_ZONE_1       || '',
  monetag2:        import.meta.env.VITE_MONETAG_ZONE_2       || '',
} as const;

export type ProviderName = keyof typeof AD_KEYS;

/** Returns true if a given provider has a key set and live mode is on */
export const isActive = (p: ProviderName) => AD_MODE && !!AD_KEYS[p];
