/*
  ## Histmap module
  * From boundmap module.
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

  var module = angular.module('kibana.panels.histmap', []);
  app.useModule(module);

  module.controller('histmap', function($scope, dashboard, querySrv, filterSrv) {
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
      description: '2D Histogram Map'
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
      stretchmin: 1,
      strechmax: 100,
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
var worldj;
  module.directive('histMap', function() {
    return {
      restrict: 'E',
      link: function(scope, element) {
        scope.$on('render',function(){
          d3.json("app/panels/histmap/world.geojson",subRender);
});


        // Render the panel when resizing browser window
        angular.element(window).bind('resize', function() {
          d3.json("app/panels/histmap/world.geojson",subRender);
        });
function subRender (countriesj)
{
worldj = countriesj;
d3.json("app/panels/histmap/ne5deg.geojson", subsubRender);
}
function subsubRender (deg5)
{
 render_panel(worldj, deg5);
}
//Function to call when you mouseover a node
function mover(d) {
  var el = d3.select(this)
    .transition()
	.duration(10)  
    .style("fill-opacity", 1)
    ;
}

//Mouseout function
function mout(d) { 
    var el = d3.select(this)
       .transition()
       .duration(1000)
       .style("fill-opacity", 0.8)
       ;
}
        // Function for rendering panel
        function render_panel(countries, ne5deg) {
          // Clear the panel
          element.html('');

          var parent_width = element.parent().width(),
              height = parseInt(scope.row.height),
              width = parent_width - 20,
              barHeight = height / scope.data.length;
	 
	 var fillcarr = [];
	    
	 var fillc = d3.scale.linear()
	    //.domain([scope.panel.stretchmin,scope.panel.stretchmax])
	    //.domain([100,1000])
	    .range(["lightsteelblue", "crimson"]);

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
    d3.select("#" + worldmap1).selectAll("path").data(ne5deg.features)
	    .enter()
	    .append("path")
	    .attr("d", geoPath)
	    .attr("class", "deg1")
	    .style("fill-opacity", .8)
	    .attr("fillct", function(d,i){
		//console.log("in fillct");
		var counteri = 0;
		var thisBounds = d3.geo.bounds(d);
		//console.log(scope.data.length);
		for (var ii=0; ii < scope.data.length; ii++)//ii in fixedCTY)//cty)
		    {
			if(thisBounds[1][0]<scope["data"][ii]["MinX"] || scope["data"][ii]["MaxX"]<thisBounds[0][0] || thisBounds[1][1]<scope["data"][ii]["MinY"] || scope["data"][ii]["MaxY"]<thisBounds[0][1])//if(thisBounds[1][0]<scope["data"]["MinX"][ii] || scope["data"]["MaxX"][ii]<thisBounds[0][0] || thisBounds[1][1]<scope["data"]["MinY"][ii] || scope["data"]["MaxY"][ii]<thisBounds[0][1])
			    {
				//return "none";
				}
			else
			    {
				counteri += 1;
				}
			}
		fillcarr.push(counteri);
		return counteri;
		})
	    .style("fill", function(d){
		fillcarr.sort(function(a,b){
		    return a-b;
		    });
		var fcmin2pct = d3.quantile(fillcarr, 0.02);
		var fcmax2pct = d3.quantile(fillcarr, 0.98);
		fillc.domain([fcmin2pct+1, fcmax2pct]);
		return fillc(d3.select(this).attr("fillct"));})
	    .style("stroke", "none")
	    .on("mouseover", mover)
	    .on("mouseout", mout)
	    .append("svg:title")
	    .text(function(d){return d3.select(this.parentNode).attr("fillct");});
    

         
        }
      }
    };
  });
});
