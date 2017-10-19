/*

  ## filtering

*/
define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('kibana.panels.simplefiltering', []);
  app.useModule(module);

  module.controller('simplefiltering', function($scope, $log, filterSrv, $rootScope, dashboard, $interpolate, $filter) {

    $scope.panelMeta = {
      modals: [{
        description: "Inspect",
        icon: "icon-info-sign",
        partial: "app/partials/inspector.html",
        show: true
      }],
      status: "Stable",
      description: "A controllable list of all filters currently applied to the dashboard. You need one of these on your dashboard somewhere in order for all the panels to work properly while you are interacting with your data."
    };

    $log.info(filterSrv);
    // Set and populate defaults
    var _d = {
      spyable: true
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.filterSrv = filterSrv;

    };

    $scope.remove = function(id, e) {
      //hack to get rid of orphaned bootstrap tooltips
      _.forEach(e.target.parentNode.parentNode.childNodes, function(elem){
        if (_.isUndefined(elem) || _.isUndefined(elem.className)){
          return;
        }
        if (elem.className.indexOf("tooltip") > -1){
          elem.remove();
        }
      });

      filterSrv.remove(id);
      dashboard.refresh();
    };

    $scope.details = function(f){
      var exp$ = "<div>'{{field}}'</div>";
      if (_.has(f, "value") && _.has(f, "mandate")){
        if (f.mandate === "must"){
          exp$ += "<div>must contain '{{ value | uridecode}}'.</div>";
        } else if (f.mandate === "mustNot"){
          exp$ += "<div>must not contain '{{ value | uridecode }}'.</div>";
        } else {
         //either?
          console.log("unexpected value for mandate");
        }
      }
      return $interpolate(exp$)(f);
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


    $scope.add = function(query) {
      query = query || '*';
      filterSrv.set({
        editing   : true,
        type      : 'querystring',
        query     : query,
        mandate   : 'must'
      },undefined,true);
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

    $scope.refresh = function() {
      $rootScope.$broadcast('refresh');
    };

    $scope.render = function() {
      $rootScope.$broadcast('render');
    };

    $scope.show_key = function(key) {
      return !_.contains(['type','id','alias','mandate','active','editing'],key);
    };

    $scope.isEditable = function(filter) {
      var uneditable = ['time','range'];
      if(_.contains(uneditable,filter.type)) {
        return false;
      } else {
        return true;
      }
    };

  });
});
