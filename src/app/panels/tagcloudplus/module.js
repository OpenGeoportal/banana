/*
  ## tagcloud

  ### Parameters
  * size :: top N
  * alignment :: How should I arrange the words in cloud 'horizontal and vertical' or 'Random'
  * fontScale :: Increase the font scale for all words
*/

define([
    'angular',
    'app',
    'underscore',
    'jquery',
    'kbn',
    'd3',
    './d3.layout.cloud'
  ],
  function(angular, app, _, $, kbn, d3) {
    'use strict';

    var module = angular.module('kibana.panels.tagcloudplus', []);
    app.useModule(module);

    module.controller('tagcloudplus', function($scope, querySrv, dashboard, filterSrv, $filter, $timeout) {
      $scope.panelMeta = {
        modals: [{
          description: "Inspect",
          icon: "icon-info-sign",
          partial: "app/partials/inspector.html",
          show: $scope.panel.spyable
        }],
        editorTabs: [{
          title: 'Queries',
          src: 'app/partials/querySelect.html'
        }],
        status: "Experimental",
        description: "Display the tag cloud of the top N words from a specified field."
      };

      // Set and populate defaults
      var _d = {
        queries: {
          mode: 'all',
          ids: [],
          query: '*:*',
          custom: ''
        },
        field: '',
        size: 10,
        alignment: 'vertical and horizontal',
        fontScale: 1,
        spyable: true,
        show_queries: true,
        error: ''
      };
      _.defaults($scope.panel, _d);

      $scope.filterSrv = filterSrv;
      $scope.list = {
        display: false,
        sort: "data",
        reverse: true
      };

      $scope.init = function() {
        $scope.hits = 0;
        $scope.$on('refresh', function() {
          $scope.get_data();
        });
        $scope.get_data();
      };


      $scope.toggleList = function(){
        $scope.list.display = !$scope.list.display;
        if (!$scope.list.display){
          $timeout(function(){$scope.$broadcast('render');});
        }
      };

      $scope.getMessage = function(){
        if ($scope.list.display){
          return "Switch back to text cloud.";
        } else {
          return "Switch to list view.";
        }
      };
      $scope.getListDisplay = function(){
        return $scope.list.display;
      };

      $scope.setOrder = function(column){
        if ($scope.list.sort === column){
          $scope.list.reverse = !$scope.list.reverse;
        } else {
          $scope.list.sort = column;
          $scope.list.reverse = false;
        }
      };

      $scope.getListHeight = function(){
        return parseInt($scope.row.height);
      };
      $scope.fieldFilter = function(termlist) {
        var result = {};
        angular.forEach(termlist, function(term, id) {
          if (!_.isUndefined(term)){
            if (term.field === $scope.panel.field && term.active){
              result[id] = term;
            }
          }
        });
        return result;
      };

      $scope.noFilters = function(termList){
          return _.size($scope.fieldFilter(termList)) === 0;
      };


      $scope.get_data = function() {
        // Make sure we have everything for the request to complete
        if (dashboard.indices.length === 0) {
          return;
        }
        delete $scope.panel.error;
        $scope.panelMeta.loading = true;
        var request, results;

        $scope.sjs.client.server(dashboard.current.solr.server + dashboard.current.solr.core_name);

        request = $scope.sjs.Request().indices(dashboard.indices);
        $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries);

        // Populate the inspector panel
        $scope.inspector = angular.toJson(JSON.parse(request.toString()), true);

        // Build Solr query
        var fq = '';
        if (filterSrv.getSolrFq() && filterSrv.getSolrFq() !== '') {
          fq = '&' + filterSrv.getSolrFq();
        }
        var wt_json = '&wt=json';
        var rows_limit = '&rows=0'; // for terms, we do not need the actual response doc, so set rows=0
        var facet = '&facet=true&facet.method=fc&facet.field=' + $scope.panel.field + '&facet.limit=' + $scope.panel.size;

        // Set the panel's query
        $scope.panel.queries.query = querySrv.getORquery() + wt_json + rows_limit + fq + facet;

        // Set the additional custom query
        if ($scope.panel.queries.custom != null) {
          request = request.setQuery($scope.panel.queries.query + $scope.panel.queries.custom);
        } else {
          request = request.setQuery($scope.panel.queries.query);
        }

        results = request.doSearch();

        // Populate scope when we have results
        results.then(function(results) {
          // Check for error and abort if found
          if (!(_.isUndefined(results.error))) {
            $scope.panel.error = $scope.parse_error(results.error.msg);
            return;
          }

          var sum = 0;
          //var k = 0;
          var missing = 0;
          $scope.panelMeta.loading = false;
          $scope.hits = results.response.numFound;
          $scope.data = [];
          $scope.maxRatio = 0;


          $scope.yaxis_min = 0;
          _.each(results.facet_counts.facet_fields, function(v) {
            for (var i = 0; i < v.length; i++) {
              var term = v[i];
              i++;
              var count = v[i];
              sum += count;
              if (term === null) {
                missing = count;
              } else {
                // if count = 0, do not add it to the chart, just skip it
                if (count === 0) {
                  continue;
                }
                var slice = {
                  label: term,
                  data: count,
                  actions: true
                };
                if (count / $scope.hits > $scope.maxRatio) {
                  $scope.maxRatio = count / $scope.hits;
                }
                $scope.data.push(slice);
              }
            }
          });
          $scope.$broadcast('render');
        });
      };

      $scope.set_refresh = function(state) {
        $scope.refresh = state;
        // if 'count' mode is selected, set decimal_points to zero automatically.
        if ($scope.panel.mode === 'count') {
          $scope.panel.decimal_points = 0;
        }
      };

      $scope.close_edit = function() {
        if ($scope.refresh) {
          $scope.get_data();
        }
        $scope.refresh = false;
        $scope.$broadcast('render');
      };

      $scope.remove = function(id) {
        filterSrv.remove(id);
        dashboard.refresh();
      };

      $scope.negateMandate = function(mandate){
        var m = 'must';
        if (mandate === 'must'){
          m = 'mustNot';
        }
        return m;
      };

      $scope.flipFilter = function(term){
        var m = $scope.negateMandate(term.mandate);
        var id = term.id;

        filterSrv.set({
          mandate: m
        }, id);

        dashboard.refresh();
      };

      $scope.display = function(f){
        var text = "";
        if (f.type === "terms"){
          text =  f.value;
        } else if (f.type === "time"){
          // In case of relative timestamps, they will be string, not Date obj.
          if (f.from instanceof Date) {
            text = f.from.getFullYear() + " to " + f.to.getFullYear();
          } else if (_.has(f, "fromDateObj")){
            text = f.fromDateObj.getFullYear() + " to " + f.toDateObj.getFullYear();
          } else {
            text = f.from + " to " + f.to;
          }
        } else if (f.type === "field" || f.type === "querystring"){
          text = f.query;

        } else if (f.type === "range"){
          text = f.from + " to " + f.to;
        }

        return $filter('uridecode')(text);
      };

      $scope.add_filter_event = function(keyword, event){
        $scope.add_filter(keyword, event.shiftKey);
      };

      $scope.add_filter = function(keyword, negate) {
        keyword.value = keyword.label;
        delete keyword.label;
        var id;
        var success = false;
        if(_.isUndefined(keyword.meta)) {
          var m = _.pick(filterSrv.list, filterSrv.idsByTypeAndField('terms', $scope.panel.field));
          var matches = 0;
          _.each(m, function(v){
            if (_.has(v, "value")){
              if (v.value === keyword.value){
                matches++;
              }
            }
          });

          if (matches === 0) {
            var filter = {
              type: 'terms',
              field: $scope.panel.field,
              value: keyword.value,
              mandate: (negate ? 'mustNot' : 'must')
            };

            id = filterSrv.set(filter);
            success = true;
          }

        } else if(keyword.meta === 'missing') {
          id = filterSrv.set({
            type:'exists',
            field: $scope.panel.field,
            mandate:(negate ? 'must':'mustNot')
          });
          success = true;
        }

        if (success){
          dashboard.refresh();
        }
      };


    });

    module.directive('tagcloudChart', function() {
      return {
        restrict: 'A',
        templateUrl: 'app/panels/tagcloudplus/tagcloudWidget.html',
        transclude: true,
        link: function(scope, element) {
          // Receive render events
          scope.$on('render', function() {
            render_cloud();
          });

          // Re-render if the window is resized
          angular.element(window).bind('resize', function() {
            render_cloud();
          });


          function get_cloud_element(){
            var el_arr = element.find('div.tagcloud');
            if (el_arr.size() > 0){
              return el_arr.first();
            } else {
              throw new Error("tagcloud element not found.");
            }
          }


          function render_cloud() {
            var $el = get_cloud_element();
            $el.html("");

            var width = $el.parent().width();
            var height = parseInt(scope.row.height) - (element.find('.filters').height() || 0);

            function draw(words) {
              var el = $el[0];
              d3.select(el).append("svg")
                  .attr("width", width)
                  .attr("height", height)
                  .append("g")
                  .attr("transform", "translate(" + (width - 20) / 2 + "," + (height - 20) / 2 + ")")
                  .selectAll("text")
                  .data(words)
                  .enter().append("text")
                  .style("font-size", function(d) {
                    return d.size + "px";
                  })
                  .style("font-family", "Impact, Haettenschweiler, 'Franklin Gothic Bold', Charcoal, 'Helvetica Inserat', 'Bitstream Vera Sans Bold', 'Arial Black', 'sans-serif'")
                  .style("fill", function(d, i) {
                    //return  color(i);
                    return fill(i);
                  })
                  .attr("text-anchor", "middle")
                  .attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                  })
                  .text(function(d) {
                    return d.text;
                  });
              $el.off('click');
              $el.on('click', 'text', function(e){
                var term$ = $(e.target).text();
                var keyword = {
                  label: term$
                };
                scope.add_filter(keyword, e.shiftKey);

              });
            }

            var fill = d3.scale.category20();
/*            var color = d3.scale.linear()
              .domain([0, 1, 2, 3, 4, 5, 6, 10, 15, 20, 100])
              .range(["#7EB26D", "#EAB839", "#6ED0E0", "#EF843C", "#E24D42", "#1F78C1", "#BA43A9", "#705DA0", "#890F02", "#0A437C", "#6D1F62", "#584477"]);*/

            var scale = d3.scale.linear().domain([0, scope.maxRatio]).range([0, 30]);
            var randomRotate = d3.scale.linear().domain([0, 1]).range([-90, 90]);

            d3.layout.cloud().size([width - 20, height - 20])
              .words(scope.data.map(function(d) {
                return {
                  text: d.label,
                  size: 5 + scale(d.data / scope.hits) + parseInt(scope.panel.fontScale)
                };
              })).rotate(function() {
                if (scope.panel.alignment === 'vertical and horizontal') {
                  return ~~(Math.random() * 2) * -90;
                } else if (scope.panel.alignment === 'horizontal') {
                  return 0;
                } else if (scope.panel.alignment === 'vertical(+90)') {
                  return 90;
                } else if (scope.panel.alignment === 'vertical(-90)') {
                  return -90;
                } else {
                  return randomRotate(Math.random());
                }
              })
              .font("sans-serif")
              .fontSize(function(d) {
                return d.size;
              })
              .on("end", draw)
              .start();

          }

        }
      };
    });

  });
