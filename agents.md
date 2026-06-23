# Project Architecture

This is a direct-deploy static Netlify site. The root `index.html` file contains the full single-page website, `styles.css` contains the visual system and responsive layout, and `script.js` handles lightweight interactions.

## Key Directories

- `assets/`: Local SVG placeholder artwork for Ashley's headshot and book covers.
- `.netlify/`: Netlify agent metadata and generated result summaries. Do not treat this as application source.

## Coding Conventions

- Keep the site framework-free unless a future request explicitly needs application state or routing.
- Use semantic HTML sections with stable `id` values so navigation links continue to smooth-scroll correctly.
- Preserve the forest witchcore palette through CSS variables in `styles.css`.
- Keep JavaScript progressive and minimal; the site should remain readable if scripts fail.

## Netlify Notes

The contact form uses Netlify Forms with `data-netlify="true"`, a unique `name`, a hidden `form-name` field, and a honeypot field. If form fields change, keep the submitted field names aligned with the markup.
