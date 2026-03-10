- Add imports section in customUI
imports : for external styles to show as virtual background layers inside top style
Use curl to fetch : https://www.mapbox.com/blog/streamline-map-development-mapbox-basemap and read the section "Imports: Compose styles instead of copying"

Use the same syntax as Mapbox : id  url fields
Fetch the imports at the beginning (in async). You do not need to prefetch the assets or at least use the same lifecycle as the main config document or add them to the style and let maplibre deal with the lifecycle but they must be shown when needed. Whatever is simplest. From the POV of users of the libraries : the imported style is viewed as a single virtual layer (shown or hidden as single unit not layer by layer inside the imported style) so behaves very similarly from another basic layer.

Consider the elements used by the imported styles  Curl : https://maplibre.org/maplibre-style-spec/  Add them to the base document with special syntax like "__imports_<id>_" prefix.  The center or the first extent + name comes from the top style. The imports are just layers + config / styles for those layers (and relevant data like fonts or icons).
Keep track of which elements of style are part of the imports : and be able to retrieve the elements of style from imports id (+ get the URL). And also to clean it ie remove all if needed.
The main style is still the style defined in the top style so the layers and icons and fonts and sources : the imports are below that and loaded on top or next to those (not the opposite). 
If the import is referenced in a visible layer at the start : still do not block the rest of the data (if part of a group or if it is a background layer and there are data layers).

The Id of an import can be referred to in backgroundLayers or the groups (see below). 

you can use https://map.atownsend.org.uk/vector/style_osmf_shortbread.json for testing and create a sample4 based on one of the samples/sample1/config.json for testing the imports.

- Add groups section in CustomUI
groups :

Refer to ids of other "layers" or ids of imports : and create a virtual layer. The group must have an id. The order of the layers in the group is relevant. 
Then use the id the group inside backgroundLayers to display them all at once. Find a way to keep track of which layer are part of a group : expose a function that does this on MapVibeMap : so with imports => get all the layers

- Be able to reference imports and groups in backgroundLayers in customUI