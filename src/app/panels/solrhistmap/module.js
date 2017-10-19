/*
 ## Histmap module
 * From base tutorial on how to create a custom Banana module.
 */
define([
        'angular',
        'app',
        'underscore',
        'jquery',
        'leaflet',
        'chroma',
        'css!../../../vendor/leaflet/dist/leaflet.css'
    ],
    function (angular, app, _, $, L, chroma) {
        'use strict';

        //$.getScript("app/panels/boundmap/queue.js");

        var module = angular.module('kibana.panels.solrhistmap', []);
        app.useModule(module);

        module.controller('solrhistmap', function ($scope, dashboard, querySrv, filterSrv) {
            $scope.panelMeta = {
                modals: [
                    {
                        description: 'Inspect',
                        icon: 'icon-info-sign',
                        partial: 'app/partials/inspector.html',
                        show: $scope.panel.spyable
                    }
                ],
                editorTabs: [
                    {
                        title: 'Queries',
                        src: 'app/partials/querySelect.html'
                    }
                ],
                status: 'Experimental',
                description: 'Gridded Map'
            };

            // Define panel's default properties and values
            var _d = {
                queries: {
                    mode: 'all',
                    query: '*:*',
                    custom: ''
                },
                field: '',
                max_rows: 100,
                fillerpct: 1,
                spyable: true,
                show_queries: true
            };

            // Set panel's default values
            _.defaults($scope.panel, _d);

            $scope.display = {
                info: ""
            };

            $scope.init = function () {
                $scope.$on('refresh', function () {
                    $scope.get_data();
                });

                $scope.get_data();

            };

            $scope.set_refresh = function (state) {
                $scope.refresh = state;
            };

            $scope.close_edit = function () {
                if ($scope.refresh) {
                    $scope.get_data();
                }
                $scope.refresh = false;
                $scope.render();
            };

            $scope.render = function () {
                $scope.$emit('render');
            };

            $scope.renderData = function () {
                $scope.$emit('renderData');
            };

            $scope.counts = [];
            $scope.bounds_geojson = {};
            $scope.get_data = function (segment,query_id) {
                // Show the spinning wheel icon
                $scope.panelMeta.loading = true;

                // Make sure we have everything for the request to complete
                if(dashboard.indices.length === 0) {
                  return;
                }

                // check if rpt field is defined
                if(_.isUndefined($scope.panel.field)) {
                  $scope.panel.error = "Please select an RPT field";
                  return;
                }

              // Solr.js
              $scope.sjs.client.server(dashboard.current.solr.server + dashboard.current.solr.core_name);

              var _segment = _.isUndefined(segment) ? 0 : segment;


              $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
              var boolQuery = $scope.sjs.BoolQuery();
                _.each($scope.panel.queries.ids,function(id) {
                  boolQuery = boolQuery.should(querySrv.getEjsObj(id));
                });

              var request = $scope.sjs.Request().indices(dashboard.indices[_segment]);

/*
                  request = request.query(
                    $scope.sjs.FilteredQuery(
                      boolQuery,
                      filterSrv.getBoolFilter(filterSrv.ids)
                    )).size($scope.panel.size); // Set the size of query result
*/

                  $scope.populate_modal(request);


                  // Build Solr query
                  var fq = '';
                  if (filterSrv.getSolrFq()) {
                    fq = '&' + filterSrv.getSolrFq();
                  }
                  var query_size = $scope.panel.size;
                  var wt_json = '&wt=json';
                  var rows_limit;
                  //var sorting = '&sort=' + filterSrv.getTimeField() + ' desc'; // Only get the latest data, sorted by time field.

                  // set the size of query result
                  if (query_size !== undefined && query_size !== 0) {
                    rows_limit = '&rows=' + query_size;
                  } else { // default
                    rows_limit = '&rows=0';
                  }

                  var heatmap_facets = '&' + $.param({
                    facet: true,
                    'facet.heatmap': $scope.panel.field,
                    'facet.heatmap.geom': $scope.boundsToHeatmapQuery(),
                      'facet.heatmap.distErrPct': 0.2
                  });

                  // Not sure if we need this filter
                  fq += '&fq=' + $scope.boundsQuery($scope.bounds);


                  // Set the panel's query
                  $scope.panel.queries.query = querySrv.getORquery() + wt_json + rows_limit + fq + heatmap_facets;// + sorting;

                  // Set the additional custom query
                  if ($scope.panel.queries.custom !== null) {
                    request = request.setQuery($scope.panel.queries.query + $scope.panel.queries.custom);
                  } else {
                    request = request.setQuery($scope.panel.queries.query);
                  }

                  var results = request.doSearch();

                  results.then(function(results) {
                    $scope.panelMeta.loading = false;

                    if(_segment === 0) {
                      $scope.data = [];
                      query_id = $scope.query_id = new Date().getTime();
                    }

                    // Check for error and abort if found
                    if(!(_.isUndefined(results.error))) {
                      $scope.panel.error = $scope.parse_error(results.error.msg);
                      return;
                    }

                    // Check that we're still on the same query, if not stop
                    if($scope.query_id === query_id) {
                      if (_.has(results, "facet_counts")) {
                        var facets = results.facet_counts;
                        if (_.has(facets, "facet_heatmaps")) {
                          if (_.has(facets.facet_heatmaps, $scope.panel.field)) {
                            var arr = facets.facet_heatmaps[$scope.panel.field];
                            var heatmap = {};
                            for (var i=0; i < arr.length; i = i + 2){
                              heatmap[arr[i]] = arr[i + 1];
                            }
                            //console.log(heatmap);
                            $scope.facetHeatmap = heatmap;
                            $scope.$emit('renderData');

                          }
                        }
                      }


                    } else {
                      return;
                    }

                    // Get $size results then stop querying
                    // Hide the spinning wheel icon
                    $scope.panelMeta.loading = false;
                    // Searching Solr using Segments
                    if($scope.data.length < $scope.panel.size && _segment+1 < dashboard.indices.length) {
                      $scope.get_data(_segment+1, $scope.query_id);
                    }
                  });
            };

            $scope.getMapBounds = function(){
              if (_.isEmpty($scope.bounds) || ($scope.bounds[0] === $scope.bounds[2]) || ($scope.bounds[1] === $scope.bounds[3])){
                return [-180, -90, 180, 90];
              } else {
                return $scope.bounds;
              }
            };

            $scope.boundsQuery = function() {
              var boundsArr = $scope.getMapBounds();
              // arr in order west, south, east, north
              return $scope.panel.field + ':"Intersects(ENVELOPE(' + boundsArr[0] + ', ' + boundsArr[2] + ', ' + boundsArr[3] + ', ' + boundsArr[1] + '))"';
            };

          $scope.boundsToHeatmapQuery = function() {
            var boundsArr = $scope.getMapBounds();
            // arr in order west, south, east, north
            return '["' + boundsArr[0] + ' ' + boundsArr[1] + '" TO "' + boundsArr[2] + ' ' + boundsArr[3] + '"]';
          };

            $scope.populate_modal = function(request) {
              //$scope.inspector = angular.toJson(JSON.parse(request.toString()), true);
            };
        });

        module.directive('histMap', function ($timeout) {
            return {

                link: function (scope, elem, attrs) {
                    var map;
                    scope.dataLayers = {};

                    // Receive render events
                    var doRender = function () {
                        if (!_.isUndefined(map)) {
                            map.invalidateSize();
                            map.getPanes();
                        }
                    };

                    scope.$on('render', function () {
                        doRender();
                    });


                    scope.$on('renderData', function () {
                        doRender();
                        scope.refreshData();
                    });

                    scope.refreshData = function(){
                        scope.clearDataLayer();
                        scope.addDataLayer();
                    };


                    scope.clearDataLayer = function () {
                        //data layer can hold multiple grids
                        _.each(scope.dataLayers, function (v, k) {
                            map.removeLayer(v);
                        });
                        scope.dataLayers = {};
                    };

                    scope.calculateBreaks = function(categories){
                        var breaks = [];
                        var vals = scope.counts;
                        //console.log({'calculate_breaks_counts': vals});
                        if (vals.length === 0){
                            return breaks;
                        }

                        var max = _.max(vals);
                        var trimmed = _.without(vals, max);
                        if (trimmed.length === 0){
                            trimmed = vals;
                        }
                        breaks = chroma.limits(trimmed, 'k', categories);

                        breaks.push(max, max);
                        breaks.unshift(breaks[0]);
                        return breaks;
                    };

                    scope.getScale = function(breaks){
                        return chroma.scale('OrRd').classes(breaks);
                    };


                    scope.addDataLayer = function () {
                        console.log("add data layer");
                        if (typeof scope.facetHeatmap === "undefined"){
                          console.log("facetHeatmap undefined");
                            return;
                        }

                      //console.log("creating geojson");
                      var grid = scope.createGeojson();

                        var cats = 10;
                        var breaks = scope.calculateBreaks(cats);

                        //if (breaks.length === 0){
                            //return;
                        //}


                        function getColor(count){
                            return scope.getScale(breaks)(count).hex();
                        }


                        function style(feature){
                            return {
                                color: '#000000',
                                weight: 0.3,
                                fillColor: getColor(feature.properties.count),
                                fillOpacity: 0.3
                            };
                        }

                        function setText(text){
                            scope.display.info = text;
                            scope.$digest();

                        }

                        function idFeature(e) {
                            var layer = e.target;
                            var props = layer.feature.properties;
                            setText(props.count + " layers");
                            if (!L.Browser.ie && !L.Browser.opera) {
                                layer.bringToFront();
                            }
                        }

                        function resetFID() {
                            setText("");
                        }


                        function onEachFeature(feature, layer) {
                            layer.on({
                                mouseover: idFeature,
                                mouseout: resetFID
                            });

                        }


                        var size = 3.0;

                        console.log(grid);
                        scope.dataLayers[size] = L.geoJson(grid, {
                            style: style,
                            onEachFeature: onEachFeature
                        }).addTo(map);


                    };

/*                    function getFill(d) {
                        var c = scope.palatte;
                        // for now, just do equal interval
                        /!*                    var category = Math.round(scope.palatte.length * Math.min(2 * d /Math.max(scope.maxCount, 1), 1)) - 1;
                         if (category < 0){
                         category = 0;
                         }*!/

                        var category = Math.round(d / 5);

                        if (d <= 1) {
                            return {
                                fillColor: '#ffffff',
                                fillOpacity: 0,
                                stroke: false
                            };
                        }
                        if (category >= c.length) {
                            return {
                                fillColor: c[c.length - 1],
                                fillOpacity: .9,
                                weight: .3,
                                color: '#000000'
                            };
                        } else {
                            return {
                                fillColor: c[category],
                                fillOpacity: .65,
                                weight: .3,
                                color: '#000000'
                            };
                        }
                    };

                    function style(feature) {
                        var count = feature.properties.count;
                        return getFill(count);
                    }*/



                  // borrowed jack's code from leaflet-solr-heatmap
                  scope.createGeojson = function() {

                    console.log("create geojson");
                    var lengthX = (scope.facetHeatmap.maxX - scope.facetHeatmap.minX) / scope.facetHeatmap.columns;
                    var lengthY = (scope.facetHeatmap.maxY - scope.facetHeatmap.minY) / scope.facetHeatmap.rows;

                    var _minLng = function(column) {
                      return scope.facetHeatmap.minX + (lengthX * column);
                    };

                    var _minLat =function(row) {
                      return scope.facetHeatmap.maxY - (lengthY * row) - lengthY;
                    };

                    var _maxLng = function(column) {
                      return scope.facetHeatmap.minX + (lengthX * column) + lengthX;
                    };

                    var _maxLat = function(row) {
                      return scope.facetHeatmap.maxY - (lengthY * row);
                    };

                    var geojson = {};

                    geojson.type = 'FeatureCollection';
                    geojson.features = [];

                    scope.maxCount = 0;
                    scope.counts = [];

                    $.each(scope.facetHeatmap.counts_ints2D, function(row, value) {
                      if (value === null) {
                        return;
                      }

                      $.each(value, function(column, val) {
                        if (val === 0) {
                          return;
                        }
                        scope.maxCount = Math.max(scope.maxCount, val);
                        scope.counts.push(val);
                        var newFeature = {
                          type: 'Feature',
                          geometry: {
                            type: 'Polygon',
                            coordinates: [
                              [
                                [_minLng(column), _minLat(row)],
                                [_minLng(column), _maxLat(row)],
                                [_maxLng(column), _maxLat(row)],
                                [_maxLng(column), _minLat(row)],
                                [_minLng(column), _minLat(row)]
                              ]
                            ]
                          },
                          properties: {
                            count: val
                          }
                        };
                        geojson.features.push(newFeature);
                      });
                    });
                    console.log({'counts': scope.counts});
                    return geojson;
                  };





/*                  _getClassifications: function(howMany)
                  {
                    var _this = this;
                    var one_d_array = [];
                    for(var i = 0; i < _this.facetHeatmap.counts_ints2D.length; i++) {
                      if (_this.facetHeatmap.counts_ints2D[i] != null) {
                        one_d_array = one_d_array.concat(_this.facetHeatmap.counts_ints2D[i]);
                      }

                    }
                    var sampled_array = _this._sampleCounts(one_d_array);

                    var series = new geostats(sampled_array);
                    var scale = _this.options.colors;
                    var classifications = series.getClassJenks(howMany);
                    return classifications;
                  },*/

                    scope.generateGrid = function (step) {
                        var fc = {
                            "type": "FeatureCollection",
                            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
                            "features": []
                        };
                        var x = -180.0, miny = -85.0, maxx = 180.0, maxy = 85.0;
                        var y = miny;
                        scope.maxCount = 0;
                        while (x < maxx) {

                            while (y < maxy) {
                                var b = [[[x, y], [x + step, y], [x + step, y + step], [x, y + step], [x, y]]];
                                var c = scope.getIntersections([x, y, x + step, y + step]);
                                scope.maxCount = Math.max(scope.maxCount, c);
                                if (c > 1) {
                                    fc.features.push(getFeature(b, c));
                                }
                                y += step;
                            }

                            x += step;
                            y = miny;
                        }
                        return {
                            grid: fc,
                            maxCount: scope.maxCount
                        };
                    };

                    var getFeature = function (geom, c) {
                        return {
                            "type": "Feature",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": geom
                            },
                            "properties": {
                                "count": c
                            }
                        };
                    };

                    scope.legend = null;

                    function createLegend() {
                        if (scope.legend !== null) {
                            map.removeControl(scope.legend);
                        }

                        scope.legend = L.control({position: 'bottomright'});

                        scope.legend.onAdd = function (map) {

                            var div = L.DomUtil.create('div', 'info legend'),
                                labels = [];
                            var interval = Math.floor(scope.maxCount / scope.palatte.length);
                            // loop through our density intervals and generate a label with a colored square for each interval
                            for (var i = 0; i < scope.palatte.length; i++) {
                                div.innerHTML +=
                                    '<span class="swatch" style="background:' + scope.palatte[i] + '"></span> ' +
                                    '<span class="interval">' + interval * i + '</span><br>';
                            }

                            return div;
                        };

                        scope.legend.addTo(map);
                    }

                    scope.palatte = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'];



                    scope.maxCount = 1;

                    // TODO: add an event handler to set this when bounds change?
                    scope.populateBounds = function(map){
                      var bounds = map.getBounds();
                      scope.bounds = [constrain_x(bounds.getWest()), constrain_y(bounds.getSouth()), constrain_x(bounds.getEast()), constrain_y(bounds.getNorth()) ];
                      scope.$broadcast("refresh");
                    };

                    function constrain_x(x_val){
                      if (x_val > 180){
                        return 180;
                      } else if (x_val < -180){
                        return -180;
                      } else {
                        return x_val;
                      }
                    }

                  function constrain_y(y_val){
                    if (y_val > 90){
                      return 90;
                    } else if (y_val < -90){
                      return -90;
                    } else {
                      return y_val;
                    }
                  }

                    function render_panel() {
                        //scope.panelMeta.loading = false;
                        L.Icon.Default.imagePath = 'app/panels/histmap/leaflet/images';
                        if (_.isUndefined(map)) {
                            var home_bounds = [[90, -180], [-90, 180]];
                            map = L.map(attrs.id, {
                                scrollWheelZoom: true,
                                center: [0, 0],
                                zoom: 1,
                                maxBounds: home_bounds,
                                maxBoundsViscosity: 1.0
                            });

                            L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
                                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                                subdomains: 'abcd',
                                maxZoom: 19
                            }).addTo(map);
                            if (map.scrollWheelZoom) {
                              map.scrollWheelZoom.disable();
                            }
                            scope.populateBounds(map);

                            map.on('zoomend', function() {
                              scope.populateBounds(map);
                            });
                          map.on('dragend', function() {
                            scope.populateBounds(map);
                          });
                        }
                        return map;
                    }

                    render_panel();

                }

            };
        });
    });
