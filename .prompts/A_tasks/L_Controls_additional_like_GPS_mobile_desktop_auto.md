- Add GeolocateControl for GPS : uses default maplibre GPS control : 
    - for trackUserLocation option : can be true false or auto : auto (default) depends on mobile or desktop  : depends on current device
    - mobile => follows the current position trackUserLocation = true
    - desktop => trackUserLocation = false
- add iPad detection in the isMobile

- add an Advanced Layer chooser. It will have the same icon on the map as the current layer chooser. However when opening it will have some sizing suitable for mobile or desktop like the layer chooser in https://cartes.gouv.fr/explorer-les-cartes/ and https://github.com/IGNF/cartes.gouv.fr . The layer definition in the config JSON may have additional data for whatever is needed for that UI : add those parts to the backgrondLayers or dataLayers in customUi that references the layer + add additional data. if needs an icon and none defined for the layer : add a default one (that does not look like it says "error").
    - make the advanded layer chooser configurable : layers draggable (by default : not ie the layers canno change position), layers deletable (by default : not ie the layers cannot be deleted)
    - the order of display is the same as for the current layer chooser (first : background layers, exclusive, then data layers on top, can have multiple)
    - unlike the chooser in cartes.gouv.fr : no transparency change, no info, no dropdown menu
    - Use radio buttons / checkboxes instead of eye icons.
    - see screenshot : '/Users/guilhem/Documents/screenshots/Screenshot 2026-10-04 at 19.39.41.png' : institut national de l'information should not appear, the dropdown should not be there, the eye icon should be a checkbox or a radio button (if datra or background layer).

- Add an header Bar : it will be a bar added ad the top above the map : define logo (optional), name + optional About + option link (URL + name)
    - About : be able to define some raw HTML (or link to some .html on the server and display it : will link to the homepage)
    - Make it small ie in mobile should not be detrimental to the use ie a third of the screen like the default cartes gouve fr UI.
   

- Make those controls be able to be chosen in the list of controls in customUI