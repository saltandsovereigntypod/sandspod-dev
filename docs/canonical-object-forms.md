# Canonical Object Forms

Sanctuary objects use three identities:

1. A Living Library entity owns Traditional Information, My Practice, Community information, and entity-level connections.
2. A form references that canonical entity and describes its label, visual asset, aliases, dimensions, and optional candle duration.
3. An object instance references both and owns placement and Living Object State. It keeps a small form snapshot so deleting a custom form cannot corrupt an existing layout.

`SanctuaryAssetCatalog` is the lightweight built-in metadata source. It is safe outside the Altar and contains backgrounds and supported form vocabulary. `ObjectFormModel` canonicalizes a form before creating an instance; it never creates Living Library entities.

The existing custom cabinet editor remains the shared candle/herb/crystal form workflow. It links to an existing canonical entity (or deliberately invokes the existing custom-entity flow), uploads per-form images, and stores form metadata in the existing `custom_cabinet_items` shape. Guest forms use the existing local cabinet cache pattern and data URLs; signed-in forms retain the established Supabase and asset-storage path.

The current candle artwork is retained as **Vigil Candle**. No approved Chime/Spell, Taper, Tea Light, or Pillar images are present, so those catalogue forms are marked unavailable rather than pointing to misleading artwork. Existing herb assets cover Loose and Fresh Sprig (plus existing Oil and Incense forms); Bundle and Powder need approved images. Crystal assets cover Point, Cluster, and Chips; Tumbled Stone needs an approved image.

Built-in candle cards now render the catalogue’s five form slots. Vigil resolves to its approved built-in image; the remaining slots display an unavailable state with **Add Form Image**. The existing cabinet image-override uploader provides create, replace, and remove behavior keyed by canonical candle attributes plus form ID, so an override never creates another Living Library entity. Only forms with a built-in image or user override can be placed. Search exposes separate form records that deep-link to the Candles category, canonical color, and requested form.
