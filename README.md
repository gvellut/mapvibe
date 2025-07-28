# MapVibe

A static map interface for embedding in blog posts or websites, as a Google My Maps replacement. Runs fully client-side, loads configuration from a single JSON file.

Made with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) and React in TypeScript.

## Configuration

- Uses the [MapLibre Style Spec](https://maplibre.org/maplibre-gl-js-docs/style-spec/) for sources, layers, and styling.
- The config file must include a `customUi` object:
  - `customUi.backgroundLayers`: List of raster layers that can be toggled as backgrounds.
  - `customUi.dataLayers`: List of data layers (lines, points, polygons) for toggling visibility.
  - `customUi.panel`: Panel color and width.
  - `customUi.controls`: Which UI controls to show (zoom, scale, layer chooser, fullscreen, attribution).
  - `customUi.globalMinZoom` / `globalMaxZoom`: Clamp zoom range for all backgrounds.
- Only one background layer should be visible at a time (including load time ie with `layout.visibility: visible`). Other layers follow standard MapLibre definitions.

## Usage

- Host the `dist` output (see the doc on [Build](#build)) and your config JSON file on your server in folder `/mapvibe`
  - Your `config.json` file can refer to icons other than the included ones: Host them on your server.
  - It can refer to your own GeoJSON data layers: Also host them on your server.
- Embed with `<iframe src="/mapvibe/?config=.../config.json" ...>`.

### Deployment in Hugo

The `dist` output can be added under `static/mapvibe` in the Hugo folder, for later deployment on your server.

Create a new `mapvibe` shortcode in `layouts/shortcodes/mapvibe.html`. For example:

```html
<iframe loading="lazy" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" 
    src="/mapvibe/?config={{ .Page.RelPermalink }}config.json" 
    width="100%" height="{{ .Get 1 }}"></iframe>
```

This assumes the post is a page bundle with the `config.json` hosted inside (so `RelPermalink` is actually a folder in Hugo).

The map can be embedded in a Hugo content using:

```html
{{< mapvibe "640" "480" >}}
```

### Example

https://blog.vellut.com/2025/07/hike-to-pointe-noire-de-pormenaz/ (scroll a little)

This was meant to replace something like:

https://blog.vellut.com/2025/06/hike-to-pointe-des-aravis-aiguille-de-borderan/ (Google My Maps)

## Development

```bash
npm install
npm run dev
```

Some simple `config.json` samples can be found in folder `samples`. To load one of them, use something like

`http://localhost:5173/?config=samples/sample1/config.json`

as the URL for testing.

## Build

```bash
npm run build
```

This will output static files to `/dist`.

There is currently no downloadable artifact for the build so you will need to run that command. Before that:
- the hosting path can be customized in `vite.config.json` (the CSS will load some assets using that path so it should correspond to where it will be hosted)
- the favicon can also be changed
- new icons can be added in `public/assets/markers` (but they can be loaded from any place so not really needed except convenience)

## License

MIT