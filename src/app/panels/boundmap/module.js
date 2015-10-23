/*
  ## Boundmap module
  * From base tutorial on how to create a custom Banana module.
*/
define([
  'angular',
  'app',
  'underscore',
  'jquery',
  'd3'
],
function (angular, app, _, $, d3) {
  'use strict';

  $.getScript("app/panels/boundmap/queue.js");

  var module = angular.module('kibana.panels.boundmap', []);
  app.useModule(module);

  module.controller('boundmap', function($scope, dashboard, querySrv, filterSrv) {
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

    $scope.init = function() {
      $scope.$on('refresh',function(){
        $scope.get_data();
      });
      $scope.get_data();
    };

    $scope.set_refresh = function(state) {
      $scope.refresh = state;
    };

    $scope.close_edit = function() {
      if ($scope.refresh) {
        $scope.get_data();
      }
      $scope.refresh = false;
      $scope.$emit('render');
    };

    $scope.render = function() {
      $scope.$emit('render');
    };

    $scope.get_data = function() {
      // Show the spinning wheel icon
      $scope.panelMeta.loading = true;

      // Set Solr server
      $scope.sjs.client.server(dashboard.current.solr.server + dashboard.current.solr.core_name);
      var request = $scope.sjs.Request();
      
      // Construct Solr query
      var fq = '';
      if (filterSrv.getSolrFq() && filterSrv.getSolrFq() != '') {
          fq = '&' + filterSrv.getSolrFq();
      }
      var wt = '&wt=csv';
      var fl = '&fl=' + $scope.panel.field + ',' + $scope.panel.field2 + ',' + $scope.panel.field3 + ',' + $scope.panel.field4;
      var rows_limit = '&rows=' + $scope.panel.max_rows;

      $scope.panel.queries.query = querySrv.getQuery(0) + fq + fl + wt + rows_limit;

      // Set the additional custom query
      if ($scope.panel.queries.custom != null) {
          request = request.setQuery($scope.panel.queries.query + $scope.panel.queries.custom);
      } else {
          request = request.setQuery($scope.panel.queries.query);
      }

      // Execute the search and get results
      var results = request.doSearch();

      // Populate scope when we have results
      results.then(function(results) {
        $scope.data = {};

        var parsedResults = d3.csv.parse(results, function(d) {
          d[$scope.panel.field] = +d[$scope.panel.field];
	  d[$scope.panel.field2] = +d[$scope.panel.field2]
	  d[$scope.panel.field3] = +d[$scope.panel.field3]
	  d[$scope.panel.field4] = +d[$scope.panel.field4];  // coerce to number
          return d;
        });

//        $scope.data = _.pluck(parsedResults,$scope.panel.field);
//	  $scope.data = d3.csv.parse(results);
	 $scope.data = parsedResults;
        $scope.render();
      });

      // Hide the spinning wheel icon
      $scope.panelMeta.loading = false;
    };
  });

  module.directive('boundMap', function() {
    return {
      restrict: 'E',
      link: function(scope, element) {
        scope.$on('render',function(){
//          queue()
	 d3.json("app/panels/boundmap/world.geojson", render_panel);
//	  .await(function(error, file1)
//		 {
//		     render_panel(file1);
//		 });
        });

        // Render the panel when resizing browser window
        angular.element(window).bind('resize', function() {
          d3.json("app/panels/boundmap/world.geojson",render_panel);
        });

        // Function for rendering panel
        function render_panel(countries) {
          // Clear the panel
          element.html('');

          var parent_width = element.parent().width(),
              height = parseInt(scope.row.height),
              width = parent_width - 20,
              barHeight = height / scope.data.length;

	 //need to create a default fillerpct
	 var fillerpct = scope.panel.fillerpct / scope.data.length;
	    if (fillerpct < 0.01)
	    {
		fillerpct = 0.01;
	    }

          var aprojection = d3.geo.mercator()
	    .scale(60)
	    .translate([width/2, height/2]);

	  var geoPath = d3.geo.path().projection(aprojection);
/*	  
	  var mapZoom = d3.behavior.zoom().translate(aprojection.translate()).scale
	    (aprojection.scale()).on("zoom", zoomed);
	  d3.select("#worldmap").call(mapZoom);
	    
	  function zoomed() {
	      aprojection.translate(mapZoom.translate()).scale(mapZoom.scale());
	      d3.selectAll("path.countries").attr("d", geoPath);
	      d3.selectAll("rect.scope")
	        .attr("x", function(d){return aprojection([d["MinX"], d["MinY"]])[0]})
                .attr("y", function(d){return aprojection([d["MaxX"], d["MaxY"]])[1]})
                .attr("width", function(d){return aprojection([d["MaxX"], d["MaxY"]])[0]-aprojection([d["MinX"], d["MinY"]])[0]})
                .attr("height", function(d){return aprojection([d["MinX"], d["MinY"]])[1]-aprojection([d["MaxX"], d["MaxY"]])[1]});
	      }

	  function zoomButton(zoomDirection) {
	      if (zoomDirection == "in") {
		  var newZoom = mapZoom.scale * 1.5;
		  var newX = ((mapZoom.translate()[0] - (width/2)) * 1.5) + width / 2;
		  var newY = ((mapZoom.translate()[1] - (height / 2)) * 1.5) + height / 2;

			 }
		  else if (zoomDirection == "out") {
		      var newZoom = mapZoom.scale() * .75;
		      var newX = ((mapZoom.translate()[0] - (width / 2)) * .75) + width / 2;
		      var newY = ((mapZoom.translate()[1] - (height / 2)) * .75) + height / 2;    
		  }

		  mapZoom.scale(newZoom).translate([newX,newY])
		  zoomed();
	      } 

	    d3.select("#controls").append("button").on("click", function () {zoomButton("in")}).html("Zoom In");
	    d3.select("#controls").append("button").on("click", function () {zoomButton("out")}).html("Zoom Out");
*/
	  var x = d3.scale.linear()
                    .domain([0, d3.max(scope.data)])
                    .range([0, width]);

          var worldmap1 = _.uniqueId("worldmap_");
           

          var mapcanv = d3.select(element[0]).append('svg')
                        .attr('width', width)
                        .attr('height', height)
                        .attr('id', worldmap1)

	  d3.select("#" + worldmap1).selectAll("path").data(countries.features)
	    .enter()
	    .append("path")
	    .attr("d", geoPath)
	    .attr("class", "countries")
	    .style("fill", "#E3F6CE")//"green")
	    .style("stroke", "black");

 

//	   d3.select("#worldmap").selectAll("circle").data(scope.data)
//	    .enter()
//	    .append("circle")
//	    .style("fill", "red")
//	    .attr("class", "boundingtest")
//	    .attr("fill-opacity", ".2")
//	    .attr("r", "3")
//	    .attr("cx", function(d){return aprojection([d["MinX"],d["MinY"]])[0]})
//	    .attr("cy", function(d){return aprojection([d["MinX"],d["MinY"]])[1]});

	   d3.select("#" + worldmap1).selectAll("rect").data(scope.data)
	    .enter()
	    .append("rect")
	    .style("fill", "red")
	    .style("fill-opacity", fillerpct)//scope.panel.fillerpct)
	    .attr("class", "bbox")
	    .attr("x", function(d){return aprojection([d["MinX"], d["MinY"]])[0]})
	    .attr("y", function(d){return aprojection([d["MaxX"], d["MaxY"]])[1]})
	    .attr("width", function(d){return aprojection([d["MaxX"], d["MaxY"]])[0]-aprojection([d["MinX"], d["MinY"]])[0]})
	    .attr("height", function(d){return aprojection([d["MinX"], d["MinY"]])[1]-aprojection([d["MaxX"], d["MaxY"]])[1]});
	    

         
        }
      }
    };
  });
});
