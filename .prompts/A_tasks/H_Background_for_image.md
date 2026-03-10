Add the processing of a imageBackgroundColor for InfoPanelData (fied found in the data layer like iamgeUrl)
It is a color expressed as a hex string eg #000000
Use in the outer div : <div style={{ width: '100%', padding: imagePadding, boxSizing: 'border-box' }}> <== that one
                            <div style={imageContainerStyle}>
                                <img
