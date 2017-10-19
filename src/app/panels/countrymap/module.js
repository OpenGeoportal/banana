/*
  ## Map

  ### Parameters
  * map :: 'world', 'us' or 'europe'
  * colors :: an array of colors to use for the regions of the map. If this is a 2
              element array, jquerymap will generate shades between these colors
  * size :: How big to make the facet. Higher = more countries
  * exclude :: Exlude the array of counties
  * spyable :: Show the 'eye' icon that reveals the last Solr query
  * index_limit :: This does nothing yet. Eventually will limit the query to the first
                   N indices
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

  var module = angular.module('kibana.panels.countrymap', []);
  app.useModule(module);

  module.controller('countrymap', function($scope, $rootScope, querySrv, dashboard, filterSrv, $q) {
    $scope.panelMeta = {
      editorTabs : [
        {title:'Queries', src:'app/partials/querySelect.html'}
      ],
      modals : [
        {
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }
      ],
      status  : "Stable",
      description : "Displays a map of shaded regions using a field containing a 2 letter country code or US state code. Regions with more hits are shaded darker. It uses Solr faceting, so it is important that you set field values to the appropriate 2-letter codes at index time. Recent additions provide the ability to compute mean/max/min/sum of a numeric field by country or state."
    };

    // Set and populate defaults
    var _d = {
      queries     : {
        mode        : 'all',
        ids         : [],
        query       : '*:*',
        custom      : ''
      },
      mode  : 'count', // mode to tell which number will be used to plot the chart.
      field : '',
      stats_field : '',
      decimal_points : 0, // The number of digits after the decimal point
      map     : "world",
/*
      colors  : ['#A0E2E2', '#265656'],
*/
      colors: ['#deebf7', '#08306b'],
      size    : 100,
      exclude : [],
      spyable : true,
      index_limit : 0,
      show_queries:true,
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      // $scope.testMultivalued();
      $scope.$on('refresh',function(){$scope.get_data();});
      $scope.get_data();
      $scope.display = {
        info: ""
      };
    };


    $scope.testMultivalued = function() {
      if($scope.panel.field && $scope.fields.typeList[$scope.panel.field].schema.indexOf("M") > -1) {
        $scope.panel.error = "Can't proceed with Multivalued field";
        return;
      }
      if($scope.panel.stats_field && $scope.fields.typeList[$scope.panel.stats_field].schema.indexOf("M") > -1) {
        $scope.panel.error = "Can't proceed with Multivalued field";
        return;
      }
    };

    $scope.set_refresh = function (state) {
      $scope.refresh = state;
      // if 'count' mode is selected, set decimal_points to zero automatically.
      if ($scope.panel.mode === 'count') {
        $scope.panel.decimal_points = 0;
      }
    };

    $scope.close_edit = function() {
      if ($scope.refresh) {
        // $scope.testMultivalued();
        $scope.get_data();
      }
      $scope.refresh = false;
    };

    $scope.get_data = function() {
      // Make sure we have everything for the request to complete
      if(dashboard.indices.length === 0) {
        return;
      }
      $scope.panelMeta.loading = true;
      delete $scope.panel.error;

      // Solr
      $scope.sjs.client.server(dashboard.get_data_core());

      var request;
      request = $scope.sjs.Request().indices(dashboard.indices);

      $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);
      // This could probably be changed to a BoolFilter
      var boolQuery = $scope.ejs.BoolQuery();
      _.each($scope.panel.queries.ids,function(id) {
        boolQuery = boolQuery.should(querySrv.getEjsObj(id));
      });

      // Then the insert into facet and make the request
      request = request
        .facet($scope.ejs.TermsFacet('map')
          .field($scope.panel.field)
          .size($scope.panel.size)
          .exclude($scope.panel.exclude)
          .facetFilter($scope.ejs.QueryFilter(
            $scope.ejs.FilteredQuery(
              boolQuery,
              filterSrv.getBoolFilter(filterSrv.ids)
              )))).size(0);

      $scope.populate_modal(request);

      // Build Solr query
      var fq = '';
      if (filterSrv.getSolrFq() && filterSrv.getSolrFq() != '') {
        fq = '&' + filterSrv.getSolrFq();
      }
      var wt_json = '&wt=json';
      var rows_limit = '&rows=0'; // for map module, we don't display results from row, but we use facets.
      var facet = '';

      if ($scope.panel.mode === 'count') {
        facet = '&facet=true&facet.method=fc&facet.field=' + $scope.panel.field + '&facet.limit=' + $scope.panel.size;
      } else {
        // if mode != 'count' then we need to use stats query
        facet = '&stats=true&stats.facet=' + $scope.panel.field + '&stats.field=' + $scope.panel.stats_field;
      }

      // Set the panel's query
      $scope.panel.queries.query = querySrv.getORquery() + wt_json + fq + rows_limit + facet;

      // Set the additional custom query
      if ($scope.panel.queries.custom != null) {
        request = request.setQuery($scope.panel.queries.query + $scope.panel.queries.custom);
      } else {
        request = request.setQuery($scope.panel.queries.query);
      }

      var results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        $scope.panelMeta.loading = false;
        // Check for error and abort if found
        if(!(_.isUndefined(results.error))) {
          $scope.panel.error = $scope.parse_error(results.error.msg);
          return;
        }
        $scope.data = {}; // empty the data for new results
        var terms = [];

        if (results.response.numFound) {
          $scope.hits = results.response.numFound;
        } else {
          // Undefined numFound or zero, clear the map.
          $scope.$emit('renderData');
          return false;
        }

        if ($scope.panel.mode === 'count') {
          terms = results.facet_counts.facet_fields[$scope.panel.field];
        } else { // stats mode
          _.each(results.stats.stats_fields[$scope.panel.stats_field].facets[$scope.panel.field], function(stats_obj,facet_field) {
            terms.push(facet_field, stats_obj[$scope.panel.mode]);
          });
        }

        if ($scope.hits > 0) {
          for (var i=0; i < terms.length; i += 2) {
            // Skip states with zero count to make them greyed out in the map.
            var count = terms[i+1];

            if (count > 0) {
              // if $scope.data[terms] is undefined, assign the value to it
              // otherwise, we will add the value. This case can happen when
              // the data contains both uppercase and lowercase state letters with
              // duplicate states (e.g. CA and ca). By adding the value, the map will
              // show correct counts for states with mixed-case letters.
              if (!$scope.data[terms[i].toUpperCase()]) {

                $scope.data[terms[i].toUpperCase()] = count;
              } else {
                $scope.data[terms[i].toUpperCase()] += count;
              }
            }
          }
        }

        $scope.$emit('renderData');
      });
    };

    // I really don't like this function, too much dom manip. Break out into directive?
    $scope.populate_modal = function(request) {
      $scope.inspector = angular.toJson(JSON.parse(request.toString()),true);
    };

    $scope.build_search = function(field, value) {
      // Set querystring to both uppercase and lowercase state values with double-quote around the value
      // to prevent query error from state=OR (Oregon)
      filterSrv.set({type:'querystring',mandate:'must',query:field+':"'+value.toUpperCase()+'" OR '+field+':"'+value.toLowerCase()+'"'});
      dashboard.refresh();
    };

  });


  module.directive('countryMap', function ($http) {
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
          if (typeof scope.data == "undefined"){
            return;
          }

          var cats = 6;
          var breaks = scope.calculateBreaks(cats);
          if (breaks.length === 0){
            return;
          }

          function getColor(count){
            return scope.getScale(breaks)(count).hex();
          }


          function style(feature){
            return {
              color: '#000000',
              weight: 1,
              fillColor: getColor(feature.properties.count),
              fillOpacity:.8
            }
          }

          function setText(text){
            scope.display.info = text;
            scope.$digest();

          }

          function highlightFeature(e) {
            var layer = e.target;

            layer.setStyle({
              weight: 2,
              color: '#FFF',
              fillOpacity: 1
            });

            var props = layer.feature.properties;
            setText(props.name + ": " + props.count + " projects");
            if (!L.Browser.ie && !L.Browser.opera) {
              layer.bringToFront();
            }
          }

          function resetHighlight(e) {
            scope.dataLayer.resetStyle(e.target);
            setText("");
          }

          function selectFeature(e){
            scope.build_search(scope.panel.field, e.target.feature.properties.iso);

          }

          function onEachFeature(feature, layer) {
            layer.on({
              mouseover: highlightFeature,
              mouseout: resetHighlight,
              click: selectFeature
            });

          }

          function filter(feature, layer){
            if (feature.properties.iso in scope.data){
              feature.properties.count = scope.data[feature.properties.iso]
              return true;
            } else {
              return false;
            }
          }

          $http.get('app/geojson/world3.geojson').then(function(data){
            scope.dataLayer = L.geoJson(data.data, {
              style: style,
              filter: filter,
              onEachFeature: onEachFeature
            }).addTo(map);


          });


        };


        function render_panel() {
          L.Icon.Default.imagePath = 'vendor/leaflet/images';
          if (_.isUndefined(map)) {
            map = L.map(attrs.id, {
              scrollWheelZoom: true,
              center: [0, 0],
              zoom: 1
            });

            L.tileLayer('http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
              subdomains: 'abcd',
              maxZoom: 19
            }).addTo(map);

            scope.refreshData();
          }

          return map;
        };

        render_panel();

      }

    };
  });

});