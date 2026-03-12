I would like for clusters in interactive data layers to be treated differently to the actual data.

I have a cluster like this :
see /Users/guilhem/Documents/projects/website/blog-vellut.com/hugo_project/content/post/2021/09/map-of-hikes-around-annecy-featured-on-the-blog/config.json

 "hikes": {
            "type": "geojson",
            "data": "/2021/09/map-of-hikes-around-annecy-featured-on-the-blog/hikes.geojson",
            "cluster": true,
            "clusterMaxZoom": 14,
            "clusterRadius": 50
        }


{
            "id": "hikes-clusters",
            "type": "circle",
            "source": "hikes",
            "filter": [
                "has",
                "point_count"
            ],
            "paint": {
                "circle-color": [
                    "step",
                    [
                        "get",
                        "point_count"
                    ],
                    "#51bbd6",
                    10,
                    "#f1f075",
                    30,
                    "#f28cb1"
                ],
                "circle-radius": [
                    "step",
                    [
                        "get",
                        "point_count"
                    ],
                    15,
                    10,
                    20,
                    30,
                    25
                ],
                "circle-stroke-width": 1,
                "circle-stroke-color": "#ffffff",
                "circle-opacity-transition": {
                    "duration": 0,
                    "delay": 0
                }
            }
        },

 {
            "id": "hikes-cluster-count",
            "type": "symbol",
            "source": "hikes",
            "filter": [
                "has",
                "point_count"
            ],
            "layout": {
                "text-field": "{point_count_abbreviated}",
                "text-font": [
                    "Open Sans Regular",
                    "Arial Unicode MS Regular"
                ],
                "text-size": 12,
                "text-allow-overlap": true,
                "text-ignore-placement": true
            },
            "paint": {
                "text-color": "#000000",
                "text-opacity-transition": {
                    "duration": 0,
                    "delay": 0
                }
            }
        },

 "dataLayers": [
            {
                "id": "hikes",
                "layerIds": [
                    "hikes-clusters",
                    "hikes-cluster-count",
                    "hikes"
                ],
                "name": "Hikes",
                "interactive": true
            }
        ],


When I click on a hikes marker : I open an info panel

However, when I click on the clusters, I would like to simply zoom. I read of getClusterExpansionZoom to use for zooming. Currently is opens an empty info panel.

I would like to keep the behaviour : when the data layer checkbox is checked : the clusters + count + actual hikes are displayed and if not, then none of them are => so group them in a data Layer

Possibly have the zoom bhevaiour I would like  for  those With has point_count or cluster_id (I suppose) simply enabled with a config option clusterInteractive : true. And make sure only the non generated (not has point or no cluster_id) in the interactive data layer can open an infopanel.
