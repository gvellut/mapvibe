in customUI section of the config JSON : 
- currently has a "controls" section with some simple true / false config eg
"controls": {
            "zoom": true,
            "scale": true,
            "layerChooser": true,
            "fullscreen": true,
            "attribution": true
        },
    => propose and implement some format to allow config of controls : 
    - which controls to show (may have multiple types for the same : for ex : I want to keep the layer chooser as it is now but also add a simplified version with other characteristics and different config option). Try to reference a control class name or some simplified version like the class name without control (see if hte maplibre controls follow that convention) or allow the 2. Do not make it too complex. Keep the list of controls explicit (ie list all the possible controls and amtch them iwth the incoming config ; will add new controls inside mapvibe code). It could also be possible to have a facade to the maplibre control so arg processing is done there, but not necessary if possible to do without. If control name is not recognized, log it in the console but keep processing the rest (do not fail).
        - if controls is mentioned : equivalent to the true in the current simplified config. Have a visible attribute : true / false (default true) : so can configure some value with the presence of hte control decided with a URL param.
    - some control config options : find out which option Maplibre controls support
    - position (instead of hardcoded top-left for ex). define a default for 
    eg attribution : would choose where + if compact
- keep compatibility with the true/ false setting like now : I have some usage of the lib with that. so for the currently used constants (like "zoom" or "scale") make it possible to have the true/false value.
- add a default setting if no "controls" section in the config.JSON : will have the params like the setting above.

- keep processing of url params in the app and passed to lib (like fullscreen or mobileCooperativeGestures or the others) : so still mixed : in config JSON + url (in simple true / false form). Merge the 2 : if config options for config + visibility set by URL param.
    - put the URL params in a structure passed as one arg to the lib instead of all separates like now.

- support the controls used now
- also add GeolocateControl (standard from maplibre)

- put all the interaction controls / setting / map interaction setting processing in a function instead of directly in mapLoad.

- add documentation of the controls + config options + other consideraions in the README. Be succinct.

- add a "interaction" section to the customUi : it will be used to set the default for rotation, tilting, 3D, etc.... See the code for what is done now.
    - propose a list of settings : with just true / false. Just a setting to disable / enable the 3 below is enough.
    - put its processing inside a separate function instead of inline with the mapLoad function
    - define a default setting : if hte interaction sections is not present. what is done currently (no rotation or pitch / tilt for ex)
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();
