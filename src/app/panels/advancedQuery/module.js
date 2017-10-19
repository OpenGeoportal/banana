/*

 ## query

 ### Parameters
 * query ::  A string or an array of querys. String if multi is off, array if it is on
 This should be fixed, it should always be an array even if its only
 one element
 */


define([
    'angular',
    'app',
    'underscore',
    'css!./query.css'
], function (angular, app, _) {
    'use strict';

    var module = angular.module('kibana.panels.advancedQuery', []);
    app.useModule(module);

    module.controller('advancedQuery', function ($scope, querySrv, $rootScope, fields, alertSrv) {
        $scope.panelMeta = {
            modals: [{
                description: "Inspect",
                icon: "icon-info-sign",
                partial: "app/partials/inspector.html",
                show: true
            }],
            status: "Stable",
            description: "Provide a search bar for free-form queries. The advanced query performs an edismax query."
        };

        $scope.$rootScope = $rootScope;
        // Set and populate defaults
        var _d = {
            query: "*",
            query_h: [],
            pinned: true,
            spyable: true,
            queryType: "",
            remember: 10, // max: 100, angular strap can't take a variable for items param
            fields: [],
            queryFields: [],
            phraseFields: [],
            phraseSlop: null
        };

        _.defaults($scope.panel, _d);

        $scope.querySrv = querySrv;
        $scope.fields = fields;
        $scope.fieldalert = {};

        $scope.init = function () {
            if ($scope.panel.queryFields.length === 0) {
                $scope.newQueryField();
            }
            if ($scope.panel.phraseFields.length === 0) {
                $scope.newPhraseField();
            }
        };

        $scope.toggle_field = function (field) {
            if (_.indexOf($scope.panel.fields, field) > -1) {
                $scope.panel.fields = _.without($scope.panel.fields, field);
            } else {
                $scope.panel.fields.push(field);
            }
        };

        var hasEmptyFields = function (arr) {
            var empty = _.filter(arr, function (field) {
                return field.field.length === 0;
            });
            return empty.length > 0;
        };

        $scope.newQueryField = function () {
            var qf = {field: "", boost: 1};
            if (!hasEmptyFields($scope.panel.queryFields)) {
                $scope.panel.queryFields.push(qf);
                alertSrv.clear($scope.fieldalert);
            }
        };

        $scope.newPhraseField = function () {
            var qf = {field: "", boost: 10};
            if (!hasEmptyFields($scope.panel.phraseFields)) {
                $scope.panel.phraseFields.push(qf);
            }

        };

        $scope.removeQueryField = function (i) {
            $scope.panel.queryFields.splice(i, 1);
            if ($scope.panel.queryFields.length === 0) {
                $scope.newQueryField();
            }
        };

        $scope.removePhraseField = function (i) {
            $scope.panel.phraseFields.splice(i, 1);
            if ($scope.panel.phraseFields.length === 0) {
                $scope.newPhraseField();
            }
        };

        // add 'pf' params and 'ps'

        $scope.refresh = function (id) {

            if (_.isUndefined(id)) {
                id = 0;
            }

            var q = querySrv.list[id];
            var isDefaultQuery = false;
            if (q.query.trim().length === 0 || q.query.trim() === $scope.panel.query) {
                q.query = $scope.panel.query;
                isDefaultQuery = true;
            }
            q.type = "edismax";
            q.fields = _.filter($scope.panel.queryFields, function (field) {
                return field.field.length > 0;
            });
            q.phrase_fields = _.filter($scope.panel.phraseFields, function (field) {
                return field.field.length > 0;
            });
            q.phrase_slop = $scope.panel.phraseSlop;

            if (q.fields.length === 0 && !isDefaultQuery) {
                // post a warning to add query fields.
                $scope.fieldalert = alertSrv.set("No query fields!", "Please specify query fields in the Advanced Query widget configuration.", "error", 0);
            } else {
                alertSrv.clear($scope.fieldalert);
            }
            $rootScope.$broadcast('refresh');
        };

        $scope.render = function () {
            $rootScope.$broadcast('render');
        };

        $scope.toggle_pin = function (id) {
            querySrv.list[id].pin = querySrv.list[id].pin ? false : true;
        };

        $scope.close_edit = function () {
            $scope.refresh();
        };

        $scope.get_qf = function () {
            // should be able to set query fields with optional boosts in the editor

            var qf = $scope.queryFields;
            var qfArr = [];
            _.each(qf, function (item) {
                qfArr.push(item.field + "^" + item.boost);
            });

            if (qfArr.length > 0) {
                return "&qf=" + qfArr.join(" ");
            }

            return "";
        };


        $scope.clear_history = function () {
            $scope.panel.history = [];
        };

        $scope.init();
    });
});
