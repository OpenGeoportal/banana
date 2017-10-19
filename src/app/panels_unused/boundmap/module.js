/*
 ## Boundmap module
 * From base tutorial on how to create a custom Banana module.
 */
define([
        'angular',
        'app',
        'underscore',
        'jquery',
        'leaflet',
        'chroma',
        'css!../../../vendor/leaflet/leaflet.css'
    ],
    function (angular, app, _, $, L, chroma) {
        'use strict';

        //$.getScript("app/panels/boundmap/queue.js");

        var module = angular.module('kibana.panels.boundmap', []);
        app.useModule(module);

        module.controller('boundmap', function ($scope, dashboard, geonamesSrv) {
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
                description: 'Bound Box Map'
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

            $scope.init = function () {
                $scope.$on('refresh', function () {
                    $scope.get_data();
                });

                $scope.get_data();
            };
            $scope.display = {
                info: ""
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


            $scope.get_data = function () {
                // Show the spinning wheel icon
                $scope.panelMeta.loading = true;

                // Execute the search and get results
                geonamesSrv.getGeoJSON($scope.panel.queries.custom).then(function (data) {
                    $scope.bounds_geojson = data.geojson;
                    $scope.counts = data.values;
                    $scope.renderData();

                }).catch(
                    function (err) {
                        console.log(err);
                    }
                ).finally(function () {
                    // Hide the spinning wheel icon
                    $scope.panelMeta.loading = false;
                });
            };
        });

        module.directive('boundMap', function () {
            return {

                link: function (scope, elem, attrs) {
                    var map;
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
                        if (typeof scope.dataLayer !== "undefined") {
                            map.removeLayer(scope.dataLayer);
                        }
                        scope.dataLayer = {};
                    };

                    //adapted from MapBox's pointInPolygon plugin
                    scope.pointInBoundingBox = function (p, geojson, first) {
                        p = [p.lng, p.lat];
                        var results = [];
                        var features = geojson.features;
                        for (var i = 0; i < features.length; i++) {
                            if (first && results.length) return;
                            var f = features[i];
                            if (pointInPolyBoundingBox({
                                    type: 'Point',
                                    coordinates: p
                                }, f.geometry.coordinates)) {
                                results.push(f);
                            }
                        }
                        ;
                        return results;
                    };

                    var pointInBoundingBox = function (point, bounds) {
                        //bounds = [minx, miny, maxx, maxy]
                        return !(point.coordinates[0] > bounds[2] || point.coordinates[0] < bounds[0] || point.coordinates[1] > bounds[3] || point.coordinates[1] < bounds[1])
                    };

                    var pointInPolyBoundingBox = function (point, polyBounds) {
                        //polybounds are polygon envelopes: [[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy], [minx, miny]]
                        var bounds = [polyBounds[0][0][0], polyBounds[0][0][1], polyBounds[0][2][0], polyBounds[0][2][1]];
                        return pointInBoundingBox(point, bounds);
                    };



                    scope.calculateBreaks = function(categories){
                        var breaks = [];
                        var vals = _.values(scope.data);

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
                        return chroma.scale('Blues').padding([.2, 0]).classes(breaks);
                    };

                    scope.addDataLayer = function () {

                        if (typeof scope.bounds_geojson === "undefined"){
                            return;
                        }

/*                        var cats = 6;
                        var breaks = scope.calculateBreaks(cats);
                        if (breaks.length === 0){
                            return;
                        }

                        function getColor(count){
                            return scope.getScale(breaks)(count).hex();
                        }*/


                        function style(feature){
                            return {
                                weight: 1
                            }
                        }

                        function setText(text){
                            scope.display.info = text;
                            scope.$digest();
                        }


                        function doCount(e){
                            var results = scope.pointInBoundingBox(e.latlng, scope.bounds_geojson);
                            var j = 0;
                            _.each(results, function (r) {
                                j += r.properties.count;
                            });
                            var popup = L.popup()
                                .setLatLng(e.latlng)
                                .setContent(j + " projects");
                            map.openPopup(popup);

                        }

                        function onEachFeature(feature, layer) {
                            layer.on({
                                click: doCount
                            });

                        }


                            scope.dataLayer = L.geoJson(scope.bounds_geojson, {
                                style: style,
                                onEachFeature: onEachFeature
                            }).addTo(map);

                            map.fitBounds(scope.dataLayer.getBounds());


                        };


                        function render_panel() {
                        L.Icon.Default.imagePath = 'vendors/leaflet/images';
                        if (_.isUndefined(map)) {
                            map = L.map(attrs.id, {
                                scrollWheelZoom: true,
                                center: [0, 0],
                                zoom: 1
                            });

                            L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
                                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
                                subdomains: 'abcd',
                                maxZoom: 19
                            }).addTo(map);


                        }

                        return map;
                    };

                    render_panel();

                }

            };
        });
    });
