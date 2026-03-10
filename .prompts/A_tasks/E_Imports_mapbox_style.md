Add imports section in customUI

imports :
Use curl to fetch : https://www.mapbox.com/blog/streamline-map-development-mapbox-basemap and read the section "Imports: Compose styles instead of copying"

Use the same syntax : when processing the imports (in async) add them to the base document with special syntax like __imports_ prefix


Add groups section in CustomUI

groups :

Refer to ids of other "layers" or ids of imports : and create a virtual layer. The group must have an id. The order of the layers in the group is relevant. 
Then use the id the group inside backgroundLayers to display them all at once. Find a way to keep track of which 

be able to reference them in backgroundLayers in customUI : imports and groups