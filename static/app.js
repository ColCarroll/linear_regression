/**
 * Created by colinc on 6/25/14.
 */
coeffsToMathJax = function(coeffs){
    var str = "y(t) = " + coeffs[0].val;
    for (var i = 1; i < coeffs.length; i++){
        if (coeffs[i].val !== 0) {
            str += (coeffs[i].val > 0) ? " + " : " - ";
            str += (Math.abs(coeffs[i].val) === 1) ? "" : Math.abs(coeffs[i].val).toString();
            str += (i === 1) ? "t" : "t^{" + i + "}";
        }
    }
    return str
};

var linearRegressionApp = angular.module("linearRegressionApp", []);

linearRegressionApp.controller("ModelCtrl", function ModelCtrl($scope, $http) {
    $scope.modelTypes = [
        {"key": "leastSquares", "value": "Least Squares"},
        {"key": "ridge", "value": "Ridge"},
        {"key": "lasso", "value": "Lasso"}
    ];

    $scope.showAlpha = false;

    $scope.parameters = {
        points: {"training": 30, "testing": 20, "plotting": 0},
        noise: 0.05,
        coeffs: [
            {"val": 0, "id": 0},
            {"val": 3, "id": 1},
            {"val": 0, "id": 2},
            {"val": -4.5, "id": 3},
            {"val": 0, "id": 4},
            {"val": 2, "id": 5},
        ],
        degree: 3,
        modelType: $scope.modelTypes[0],
        alpha: 1.0,
        normalize: false
    };

    $scope.data = {};

    $scope.dataUrl = function(datatype) {
        $scope.updateTexCoeffs();
        return "/api/gen_data/" + datatype + "/" + this.parameters.points[datatype] + "/" + this.parameters.noise;
    };

    $scope.coeffUrl = function() {
        var url = "/api/update_coeffs/?";
        for (var i = 0; i < this.parameters.coeffs.length; i++){
            url += this.parameters.coeffs[i].id + "=" +this.parameters.coeffs[i].val + "&";
        }
        return url.slice(0, url.length - 1)
    };

    $scope.updateTexCoeffs = function(){
        $scope.texCoeffs = coeffsToMathJax(this.parameters.coeffs) + "+ \\mathscr{N}(0, " + this.parameters.noise + ")";
    };

    $scope.updateNormalize = function() {
        $http({
            method: 'GET',
            url: "/api/normalize/" + this.parameters.normalize.toString()
        }).success(function(data){
            $scope.errors = data.errors;
            $scope.model = data.model;
            $scope.modelCoefs = coeffsToMathJax(data.model_coefs);
        });
    };

    $scope.updateModel = function() {
        $http({
            method: 'GET',
            url: "/api/model/"
        }).success(function(data){
            $scope.errors = data.errors;
            $scope.model = data.model;
            $scope.modelCoefs = coeffsToMathJax(data.model_coefs);
        });
    };

    $scope.updateModelType = function() {
        $http({
            method: 'GET',
            url: "/api/model_type/" + this.parameters.modelType.key
        }).success(function(data){
            $scope.errors = data.errors;
            $scope.model = data.model;
            $scope.modelCoefs = coeffsToMathJax(data.model_coefs);
        });
        $scope.showAlpha = (this.parameters.modelType.key !== "leastSquares");
    };

    $scope.updateDegree = function() {
        $http({
            method: 'GET',
            url: "/api/degree/" + this.parameters.degree
        }).success(function(data){
            $scope.errors = data.errors;
            $scope.model = data.model;
            $scope.modelCoefs = coeffsToMathJax(data.model_coefs);
        });
    };

    $scope.updateAlpha = function() {
        $http({
            method: 'GET',
            url: "/api/alpha/" + this.parameters.alpha
        }).success(function(data){
            $scope.errors = data.errors;
            $scope.model = data.model;
            $scope.modelCoefs = coeffsToMathJax(data.model_coefs);
        });
        $scope.updateTexCoeffs();
        $scope.updateModel();

    };

    $scope.updateCoeffs = function() {
        $http({
            method: 'GET',
            url: $scope.coeffUrl()
        }).success(function(data){
            $scope.data.training = data.trainingData;
            $scope.data.testing = data.testingData;
        });
        $scope.updateTexCoeffs();
        $scope.updateModel();
    };

    $scope.getData = function(datatype) {
        $http({
            method: 'GET',
            url: $scope.dataUrl(datatype)
        }).success(function(data){
            $scope.data[datatype] = data.data;
        });
        $scope.updateModel();
    };

    $scope.addCoefficient = function(){
        var newId = this.parameters.coeffs.length;
        $scope.parameters.coeffs.push({"val": 0, "id": newId});
    };

    $scope.removeCoefficient = function(){
        if($scope.parameters.coeffs.length > 1) {
            var curVal = $scope.parameters.coeffs.pop();
            if (curVal.val !== 0){
                $scope.updateCoeffs();
                $scope.updateModel();
            }
        }
    };


    $scope.updateCoeffs();
    $scope.getData("training");
    $scope.getData("testing");
    $scope.getData("plotting");
    $scope.updateDegree();
    $scope.updateAlpha();
    $scope.updateModel();

});


linearRegressionApp.directive("trainingScatter", function(){
    // constants
    var margin = {top: 20, right: 20, bottom: 30, left: 40},
        duration = 200,
        height = 300;


    return {
        restrict: "EA",
        scope: {
            pointData: '=',
            lineData: '='
        },
        link: function (scope, element, attrs) {
            var svg = d3.select(element[0]).append("svg")
                .style("width", "100%")
                .style("height", height + margin.top + margin.bottom);

            var width = svg[0][0].clientWidth - margin.left - margin.right;

            var xValue = function (d) {return d.x;},
                xScale = d3.scale.linear().range([0, width]).domain([-1.1, 1.1]),
                xMap = function (d) {return xScale(xValue(d));},
                xAxis = d3.svg.axis().scale(xScale).orient("bottom");

            var yValue = function (d) {return d.y;},
                yScale = d3.scale.linear().range([height, 0]),
                yMap = function (d) {return yScale(yValue(d));},
                yAxis = d3.svg.axis().scale(yScale).orient("right"),
                line = d3.svg.line().interpolate("basis").x(xMap).y(yMap);
            // x-axis
            svg.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(xAxis)
                .append("text")
                .attr("class", "label")
                .attr("x", width - 5)
                .attr("y", -2);

            // y-axis
            svg.append("g")
                .attr("class", "y axis")
                .attr("transform", "translate(" + width + ", 0)")
                .call(yAxis)
                .append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", "-1.2em");

            svg.attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            scope.$watch("pointData", function (data) {
                scope.renderPoints(data);
            });

            scope.$watch("lineData", function (data) {
                scope.renderLines(data);
            });

            svg.append("path")
                .datum([])
                .attr("d", line)
                .attr("class", "line");

            scope.renderPoints = function (newData) {
                if (!newData || isNaN(newData.length)) return;
                yScale.domain([d3.min(newData, yValue) - 0.05, d3.max(newData, yValue) + 0.05]);

                svg.selectAll(".dot")
                    .remove();

                svg.selectAll(".dot").data(newData)
                    .enter()
                    .append("circle")
                    .attr("class", "dot")
                    .attr("r", 2.5)
                    .attr("cx", xMap)
                    .attr("cy", yMap)
                    .style("fill", "steelblue")
                    .style("fill-opacity", 1e-6)
                    .transition()
                    .duration(duration)
                    .style("fill-opacity", 0.7);

                svg.selectAll("g.y.axis")
                    .call(yAxis);

                svg.selectAll("g.x.axis")
                    .call(xAxis);
            };

            scope.renderLines = function (newData) {
                if (!newData || isNaN(newData.length)) return;
                svg.selectAll(".line")
                    .datum(newData)
                    .transition()
                    .duration(2 * duration)
                    .attr("d", line)
                    .attr("class", "line");
            }
        }
    }
});

linearRegressionApp.directive("mathjaxBind", function() {
    return {
        restrict: "A",
        controller: ["$scope", "$element", "$attrs",
            function($scope, $element, $attrs) {
                $scope.$watch($attrs.mathjaxBind, function(texExpression) {
                    var texScript = angular.element("<script type='math/tex'>")
                        .html(texExpression ? texExpression :  "");
                    $element.html("");
                    $element.append(texScript);
                    MathJax.Hub.Queue(["Reprocess", MathJax.Hub, $element[0]]);
                });
            }]
    };
});
