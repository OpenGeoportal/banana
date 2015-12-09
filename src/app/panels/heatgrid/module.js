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

        var module = angular.module('kibana.panels.heatgrid', []);
        app.useModule(module);

        module.controller('heatgrid' +
            '', function ($scope, querySrv, dashboard, filterSrv) {
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


        });

        module.directive('heatgrid', function ($timeout) {
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
