- Fix :  layers.__imports_shortbread_label_village.layout.icon-image: "zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.

using the config4 sample and https://tiles.openfreemap.org/styles/liberty as imports
when loading the map : the imports is not yet made visible. This is the log displayed. Fix

- Also For some reason the zoom is blocked quite higth
using https://tiles.openfreemap.org/styles/liberty  as imports
=> when starting with one with no limit : zooms are functional. When radio switched to that layer : dezoom immediateley and zoom+ is blocked. But switching to the first one (no zoom limit) : the zoom is still blocked
The zoom minus is also blocked after only one unzoom.

the https://tiles.openfreemap.org/styles/liberty when loading by itself as top : does not have zoom blocks. So fix.
