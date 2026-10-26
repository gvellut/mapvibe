I would like to retain which layers are visible across web page reloads
- so if never run : uses the "visible" of the config.json
- if already run, has saved the visiblity and reuse that
based on the ids of the dataLayers and backgroundLayers

If a saved visible layer is no longer defined : if background layer, go back to the default visible layer (so at least something is shown); if data layer, simply do not show it.

follow remember last position : configurable in config.json + runtime option + url parameter.