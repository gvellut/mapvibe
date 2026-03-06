Add a "imageSizeIsMax": true

"customUi": {
        "panel": {
            "backgroundColor": "#f8f9fa",
            "width": "250px",
            "imageSizeIsMax": true
        },

Default is False (no change from now).
If set to True : the "imageSize" field in each feature serves as the max dimension. So if the space is bigger (in width usually) than those dimensions : the space if made smaller. The image must be centered horizontally.
This is for small images : if the wdith of the info panel is too big, the images will look pixelated. This setting is to prevent that.
If the space is smaller : then the image is adjusted to the space (like now)