# Sanctuary accessibility controls

The shared `js/accessibility.js` module adds one **Accessibility Options** entry point to primary Sanctuary pages. It supplements semantic HTML and browser or operating-system features; it is not a claim of WCAG conformance.

## Preference model and persistence

Validated preferences include text scale (90–130 percent), line spacing, letter spacing, readable system font, high contrast, reduced motion, hidden decoration, reading ruler, and focus mode. Unsupported types and scale values fall back to defaults.

Preferences use explicit device keys: one guest key and one key per authenticated user ID. Authentication events switch scopes so one account's settings are not displayed for another. These are device preferences rather than authored Sanctuary backup content and are not part of guest-data clearing. Focus mode is session-only; persisted data resets it to false so a page never unexpectedly reloads dimmed.

Guest preferences apply synchronously when the shared script loads. Authenticated preferences apply after auth resolution without waiting for cloud data. The current `user_settings` schema has no dedicated accessibility field, so this version does not assume an unsafe cloud column; signed-in preferences remain user-scoped on the current device.

## Root styling

The module sets `--accessibility-text-scale` and validated `a11y-*` root classes. Spacing targets prose and controls rather than Altar object positioning. Readable font uses an installed system sans-serif stack. High contrast strengthens shared colors and borders while retaining the dark palette and focus outlines. Hide Decoration affects only `.is-decorative` content and the nonfunctional page backdrop; it never broadly hides images, SVGs, Altar objects, or functional symbols.

System `prefers-reduced-motion` is always honored. The manual setting supplements it by shortening nonessential animation and disabling smooth scrolling without disabling pointer-driven Altar movement. `prefers-contrast` strengthens borders, while `forced-colors` remains browser-controlled. Viewport markup keeps browser and pinch zoom available.

## Panel and keyboard behavior

The panel is a native modal dialog with a labeled heading, visible close control, real buttons, `aria-pressed` state, and a polite live status. Focus enters on open and returns to the trigger on close. Escape closes through the dialog cancel event. The control grid collapses at narrow widths.

Focus mode dims only top-level header and footer chrome; keyboard focus or hover reveals them while primary content, dialogs, and the Digital Altar remain usable. Escape exits focus mode when the panel is closed.

## Reading ruler limitations

The pointer-events-none ruler is ignored by assistive technology. It follows mouse or pen position but hides over dialogs and the Altar. Touch tracking is intentionally disabled because it could conflict with Cabinet scrolling and Altar dragging.

## Manual verification and known gaps

Verify Home, Altar, Book of Shadows, Living Library, Settings/Account & Data, ritual pages, and submission surfaces at 320 pixels and wider. Check every toggle, reset, refresh persistence, account switching, dialog focus, Escape, browser zoom, forced colors, and system reduced motion. Physical screen-reader, mobile-browser, and high-zoom testing remain required. A future audit should review remaining legacy form labels, meaningful image alternatives, heading structure, older modal isolation, and component-specific contrast.
