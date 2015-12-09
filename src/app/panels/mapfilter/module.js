/*

 ## Better maps

 ### Parameters
 * size :: How many results to show, more results = slower
 * field :: field containing a 2 element array in the format [lon,lat]
 * tooltip :: field to extract the tool tip value from
 * spyable :: Show the 'eye' icon that reveals the last ES query
 */
var $test2;
define([
        'angular',
        'app',
        'underscore',
        './leaflet/leaflet-src',
        'require',
        //'./leaflet/plugins', // moving it here causing error in the app, fallback to the old Kibana way.
        'css!./module.css',
        'css!./leaflet/leaflet.css',
        'css!./leaflet/plugins.css'
    ],
    function (angular, app, _, L, localRequire) {
        'use strict';

        var DEBUG = false; // DEBUG mode

        var module = angular.module('kibana.panels.mapfilter', []);
        app.useModule(module);

        module.controller('mapfilter', function ($scope, querySrv, dashboard, filterSrv) {
            $scope.panelMeta = {
                modals: [
                    {
                        description: "Inspect",
                        icon: "icon-info-sign",
                        partial: "app/partials/inspector.html",
                        show: $scope.panel.spyable
                    }
                ],
                editorTabs: [
                    {
                        title: 'Queries',
                        src: 'app/partials/querySelect.html'
                    }
                ],
                status: "Experimental",
                description: "Creates a filter based on displayed bounds."
            };
            // Set and populate defaults
            var _d = {
                queries: {
                    mode: 'all',
                    ids: [],
                    query: '*:*',
                    custom: ''
                },
                size: 1000,
                spyable: true,
                lat_start: '-90.0',
                lat_end: '90.0',
                lon_start: '-180.0',
                lon_end: '180.0',
                bounds: [],
                obounds: {},
//      tooltip : "_id",
                field: null,
                show_queries: true
            };

            _.defaults($scope.panel, _d);
            //$scope.requireContext = localRequire;

            // inorder to use relative paths in require calls, require needs a context to run. Without
            // setting this property the paths would be relative to the app not this context/file.
            $scope.init = function () {
                $scope.filterSrv = filterSrv;
            };

            $scope.remove = function (id) {
                filterSrv.remove(id);
                dashboard.refresh();
            };

            $scope.add = function (query) {
                query = query || '*';
                filterSrv.set({
                    editing: true,
                    type: 'querystring',
                    query: query,
                    mandate: 'must'
                }, undefined, true);
            };

            $scope.toggle = function (id) {
                filterSrv.list[id].active = !filterSrv.list[id].active;
                dashboard.refresh();
            };


            $scope.set_refresh = function (state) {
                $scope.refresh = state;
            };

            $scope.populate_modal = function (request) {
                $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);
            };

            /*

             // term objects
             // boost have to be extremely high when using boost function syntax to match
             // up with
             // values in previous version.
             this.LayerWithinMap = {
             term : "LayerWithinMap",
             boost : 80.0
             };

             this.LayerMatchesScale = {
             term : "LayerMatchesScale",
             boost : 70.0
             };
             this.LayerMatchesCenter = {
             term : "LayerMatchesCenter",
             boost : 15.0
             };

             this.LayerAreaIntersection = {
             term : "LayerAreaIntersection",
             boost : 30.0
             };

             var bf_array = [
             this.classicLayerMatchesArea(bounds) + "^"
             + this.LayerMatchesScale.boost,
             this.classicLayerAreaIntersectionScore(bounds) + "^"
             + this.LayerAreaIntersection.boost,
             this.classicCenterRelevancyClause() + "^"
             + this.LayerMatchesCenter.boost,
             this.classicLayerWithinMap(bounds) + "^"
             + this.LayerWithinMap.boost ];
             var params = {
             bf : bf_array,
             fq : [ this.getIntersectionFilter() ],
             intx : this.getIntersectionFunction(bounds)
             };

             this.getIntersectionFilter = function() {
             // this filter should not be cached, since it will be different each
             // time
             return "{!frange l=0 incl=false cache=false}$intx";

             };

             this.getIntersectionFunction = function(bounds) {
             // TODO: this needs work. have to account for dateline crossing properly
             var getRangeClause = function(minVal, minTerm, maxVal, maxTerm) {

             var rangeClause = "max(0,sub(min(" + maxVal + "," + maxTerm
             + "),max(" + minVal + "," + minTerm + ")))";
             return rangeClause;
             };

             var xRange;
             if (bounds.minX > bounds.maxX) {
             // crosses the dateline
             var xRange1 = getRangeClause(bounds.minX, "MinX", 180, "MaxX");
             var xRange2 = getRangeClause(-180, "MinX", bounds.maxX, "MaxX");
             xRange = "sum(" + xRange1 + "," + xRange2 + ")";
             } else {
             xRange = getRangeClause(bounds.minX, "MinX", bounds.maxX, "MaxX");
             }

             var yRange = getRangeClause(bounds.minY, "MinY", bounds.maxY, "MaxY");

             var intersection = "product(" + xRange + "," + yRange + ")";

             return intersection;

             };

             this.layerNearCenterClause = function(center, minTerm, maxTerm) {
             var smoothingFactor = 1000;
             var layerMatchesCenter = "recip(abs(sub(product(sum(" + minTerm + ","
             + maxTerm + "),.5)," + center + ")),1," + smoothingFactor + ","
             + smoothingFactor + ")";
             return layerMatchesCenter;
             };

             this.classicCenterRelevancyClause = function() {
             var center = this.getCenter();
             var clause = "sum("
             + this.layerNearCenterClause(center.centerX, "MinX", "MaxX")
             + ",";
             clause += this.layerNearCenterClause(center.centerY, "MinY", "MaxY")
             + ")";
             return clause;
             };


             this.classicLayerMatchesArea = function(bounds) {
             var mapDeltaX = Math.abs(bounds.maxX - bounds.minX);
             var mapDeltaY = Math.abs(bounds.maxY - bounds.minY);
             var mapArea = (mapDeltaX * mapDeltaY);
             var smoothingFactor = 1000;
             var layerMatchesArea = "recip(sum(abs(sub(Area," + mapArea
             + ")),.01),1," + smoothingFactor + "," + smoothingFactor + ")";
             return layerMatchesArea;
             };
             this.classicLayerAreaIntersectionScore = function(bounds) {
             var mapMaxX = bounds.maxX;
             var mapMinX = bounds.minX;
             var mapMinY = bounds.minY;
             var mapMaxY = bounds.maxY;

             var stepCount = 3; // use 3x3 grid
             var mapDeltaX = Math.abs(mapMaxX - mapMinX);
             var mapXStepSize = mapDeltaX / (stepCount + 1.);

             var mapDeltaY = Math.abs(mapMaxY - mapMinY);
             var mapYStepSize = mapDeltaY / (stepCount + 1.);

             var clause = "sum("; // add up all the map points within the layer
             for (var i = 0; i < stepCount; i++) {

             for (var j = 0; j < stepCount; j++) {

             var currentMapX = mapMinX + ((i + 1) * mapXStepSize);
             var currentMapY = mapMinY + ((j + 1) * mapYStepSize);

             // console.log([currentMapX, currentMapY]);
             // is the current map point in the layer
             // that is, is currentMapX between MinX and MaxX and is
             // currentMapY betweeen MinY and MaxY

             // why 400? this should not be a fixed size
             var thisPointWithin = "map(sum(map(sub(" + currentMapX
             + ",MinX),0,400,1,0),";
             thisPointWithin += "map(sub(" + currentMapX
             + ",MaxX),-400,0,1,0),";
             thisPointWithin += "map(sub(" + currentMapY
             + ",MinY),0,400,1,0),";
             thisPointWithin += "map(sub(" + currentMapY
             + ",MaxY),-400,0,1,0)),";
             thisPointWithin += "4,4,1,0)"; // final map values

             // note that map(" + currentMapX + ",MinX,MaxX,1,0) doesn't work
             // because the min,max,target in map must be constants, not
             // field values
             // so we do many sub based comparisons

             if ((i > 0) || (j > 0)) {
             clause += ","; // comma separate point checks
             }

             clause += thisPointWithin;
             }
             }
             clause += ")";

             // clause has the sum of 9 point checks, this could be 9,6,4,3,2,1 or 0
             // normalize to between 0 and 1, then multiple by boost

             clause = "product(" + clause + "," + (1.0 / (stepCount * stepCount))
             + ")";

             return clause;
             };
             this.classicLayerWithinMap = function(bounds) {
             var mapMinX = bounds.minX;
             var mapMaxX = bounds.maxX;
             var mapMinY = bounds.minY;
             var mapMaxY = bounds.maxY;

             var layerWithinMap = "if(and(exists(MinX),exists(MaxX),exists(MinY),exists(MaxY)),";

             layerWithinMap += "map(sum(";
             layerWithinMap += "map(MinX," + mapMinX + "," + mapMaxX + ",1,0),";
             layerWithinMap += "map(MaxX," + mapMinX + "," + mapMaxX + ",1,0),";
             layerWithinMap += "map(MinY," + mapMinY + "," + mapMaxY + ",1,0),";
             layerWithinMap += "map(MaxY," + mapMinY + "," + mapMaxY + ",1,0))";
             layerWithinMap += ",4,4,1,0),0)";

             return layerWithinMap;
             };


             */


        });

        module.directive('mapfilter', function ($timeout) {
            return {
                scope: {
                    "minX": "=",
                    "minY": "=",
                    "maxX": "=",
                    "maxY": "="
                },
                link: function (scope, elem, attrs) {
                    var map;
                    // Receive render events
                    scope.$on('draw', function () {
                        render_panel();
                    });

                    scope.$on('render', function () {
                        if (!_.isUndefined(map)) {
                            map.invalidateSize();
                            map.getPanes();
                        }
                    });

                    var coordRound = function (coord) {
                        var num = parseFloat(coord);
                        return Math.round((num + 0.0000001) * 10000) / 10000;
                    };

                    scope.setBounds = function () {
                        $timeout(function () {
                            var bounds$ = map.getBounds().toBBoxString().split(",");
                            var bounds = [];
                            bounds[0] = coordRound(bounds$[0]);
                            bounds[1] = coordRound(bounds$[1]);
                            bounds[2] = coordRound(bounds$[2]);
                            bounds[3] = coordRound(bounds$[3]);

                            scope.minX = Math.max(bounds[0], -180.0);
                            scope.minY = Math.max(bounds[1], -85.0);
                            scope.maxX = Math.min(bounds[2], 180.0);
                            scope.maxY = Math.min(bounds[3], 85.0);
                        });
                    };

                    function render_panel() {
                        //scope.panelMeta.loading = false;

                        L.Icon.Default.imagePath = 'app/panels/bettermap/leaflet/images';
                        if (_.isUndefined(map)) {
                            map = L.map(attrs.id, {
                                scrollWheelZoom: true,
                                center: [0, 0],
                                zoom: 1
                            });

                            // Add Change to the tile layer url, because it was returning 403 (forbidden)
                            // Forbidden because of API Key in cloudmade, so I used osm for now
                            // osm (open street map) (http://{s}.tile.osm.org/{z}/{x}/{y}.png)
                            // cloud made (http://{s}.tile.cloudmade.com/57cbb6ca8cac418dbb1a402586df4528/22677/256/{z}/{x}/{y}.png)
                            L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
                                attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
                                maxZoom: 18,
                                minZoom: 0
                            }).addTo(map);


                            scope.setBounds();


                            /*
                             //requires AreaSelect
                             var ToggleBoundsControl = L.Control.extend({

                             options: {
                             position: 'topright',
                             areaSelect: null
                             },

                             toggle: function(){
                             if (L.DomUtil.hasClass(this._container, 'enabled')){
                             L.DomUtil.removeClass(this._container, 'enabled')
                             this.areaSelect.remove();
                             } else {
                             L.DomUtil.addClass(this._container, 'enabled')
                             this.addAreaSelect();
                             }
                             },

                             addAreaSelect: function(){
                             // add AreaSelect with keepAspectRatio:true
                             this.areaSelect = L.areaSelect({
                             width:100,
                             height:150,
                             keepAspectRatio:false
                             });
                             this.areaSelect.addTo(this._map);
                             },

                             onAdd: function (map) {
                             // create the control container with a particular class name
                             this._container = L.DomUtil.create('div', 'toggle-bounds-control');
                             this._map = map;

                             L.DomEvent
                             .addListener(this._container, 'click', L.DomEvent.stopPropagation)
                             .addListener(this._container, 'click', L.DomEvent.preventDefault)
                             .addListener(this._container, 'click', this.toggle, this);
                             // ... initialize other DOM elements, add listeners, etc.

                             return this._container;
                             }
                             });

                             map.addControl(new ToggleBoundsControl());
                             */

                        }

                        return map;
                    };


                    render_panel();
                    map.on('moveend', scope.setBounds);
                }

            };
        });

    });
