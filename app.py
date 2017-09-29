import os
import numpy
import numpy.random
from sklearn import linear_model
from sklearn.preprocessing import normalize
from flask import Flask, make_response, jsonify, request

DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)


class Modeler:
    n_points = 100
    x_min = -1
    x_max = 1
    data_types = ("training", "testing", "plotting")

    def __init__(self):
        self.data_sets = {key: {"x": None, "y": None, "preds": None, "norm": None} for key in self.data_types}
        self.features = {key: None for key in self.data_types}
        self.__errors = {key: 0 for key in self.data_types if key != "plotting"}
        self.eps = None
        self.gen_coeffs = [1, 2, -1]

        self.__degree = 3
        self.model = linear_model.LinearRegression()
        self.alpha = 1.0
        self.model_type = None
        self.data_sets["plotting"]["x"] = numpy.linspace(self.x_min, self.x_max, 250)
        self.normalize = False

    def update_model_type(self, model_type):
        self.model_type = model_type
        if model_type == "ridge":
            self.model = linear_model.Ridge(self.alpha)
        elif model_type == "lasso":
            self.model = linear_model.Lasso(self.alpha)
        else:
            self.model = linear_model.LinearRegression()
        self.update_model()

    def update_normalize(self, should_normalize):
        if should_normalize != self.normalize:
            self.normalize = should_normalize
            self.update_model()

    def update_alpha(self, alpha):
        self.alpha = 10 ** alpha
        self.update_model_type(self.model_type)

    def coefs_(self):
        return [{"val": round(val, 2), "id": degree} for
                val, degree in zip([self.model.intercept_] + list(self.model.coef_[1:]), range(self.__degree + 1))]

    def update_degree(self, degree):
        self.__degree = degree
        for data_type in self.features.keys():
            self.update_features(data_type)
        self.update_model()

    def update_features(self, data_set):
        self.features[data_set] = numpy.array(
            [numpy.power(self.data_sets[data_set]["x"], j) for j in range(self.__degree + 1)]
        ).T

    @property
    def errors(self):
        errs = {}
        for key, value in self.__errors.iteritems():
            if numpy.isnan(value):
                errs[key] = "0"
            else:
                errs[key] = "{:,.3f}".format(value)
        return errs

    def generating_func(self, n, eps, gen_coeffs=None):
        if gen_coeffs is None:
            gen_coeffs = self.gen_coeffs

        def func(x):
            return sum(numpy.power(x, j) * coeff for j, coeff in enumerate(gen_coeffs))

        x_points = (self.x_max - self.x_min) * numpy.random.random(n) + self.x_min
        noise = eps * numpy.random.normal(0, 1, n)
        return x_points, func(x_points) + noise

    def update_model(self):
        if self.features["training"] is not None:
            if self.normalize:
                self.model.fit(normalize(self.features["training"], axis=1, norm='l1'), self.data_sets["training"]["y"])
            else:
                self.model.fit(self.features["training"], self.data_sets["training"]["y"])
            for data_set in self.features.iterkeys():
                if self.normalize:
                    self.data_sets[data_set]["preds"] = self.model.predict(normalize(self.features[data_set], axis=1, norm='l1'))
                else:
                    self.data_sets[data_set]["preds"] = self.model.predict(self.features[data_set])
                if data_set == "plotting":
                    self.__errors[data_set] = 0
                else:
                    self.__errors[data_set] = numpy.power(
                        self.data_sets[data_set]["preds"] - self.data_sets[data_set]["y"], 2).mean() ** 0.5

    def gen_data(self, data_type, n=None, eps=None):
        regen = False
        data_set = self.data_sets[data_type]
        if data_type == "plotting":
            self.update_degree(self.__degree)
            data_set["y"] = data_set["preds"]
            return data_set
        if n is None:
            regen = True
            n = len(data_set["x"])
        if eps is None:
            regen = True
            eps = self.eps
        if data_set["x"] is None or len(data_set["x"]) != n or self.eps != eps or regen:
            self.eps = eps
            data_set["x"], data_set["y"] = self.generating_func(n, self.eps)
            self.update_features(data_type)
        return data_set

    def gen_json_data(self, data_type, n=None, eps=None):
        data_set = self.gen_data(data_type, n, eps)
        return sorted([{"x": x, "y": y} for x, y in zip(data_set["x"], data_set["y"])], key=lambda j: j["x"])

    def update_coeffs(self, coeffs):
        self.gen_coeffs = coeffs


MODEL = Modeler()


@app.route('/')
def index():
    return make_response(open(os.path.join(DIR, 'index.html')).read())


@app.route('/api/update_coeffs/')
def update_coeffs():
    args = request.args.items()
    coeffs = [0 for _ in args]
    for (idx, val) in args:
        coeffs[int(idx)] = float(val)
    MODEL.update_coeffs(coeffs)
    return jsonify({
        "trainingData": MODEL.gen_json_data("training"),
        "testingData": MODEL.gen_json_data("testing"),
    })


@app.route('/api/update_fit_degree/<int:degree>')
def update_fit_degree(degree):
    MODEL.update_degree(degree)
    return jsonify({
        "trainingData": MODEL.gen_json_data("training"),
        "testingData": MODEL.gen_json_data("testing"),
    })


@app.route('/api/gen_data/<dataset>/<int:n>/<eps>/')
def gen_data(dataset, n, eps):
    try:
        eps = float(eps)
    except ValueError:
        eps = 0.1
    return jsonify({"data": MODEL.gen_json_data(dataset, n, eps)})


@app.route('/api/degree/<int:degree>')
def update_degree(degree):
    MODEL.update_degree(degree)
    return jsonify({"model": MODEL.gen_json_data("plotting"), "errors": MODEL.errors, "model_coefs": MODEL.coefs_()})


@app.route('/api/model/')
def update_model():
    MODEL.update_model()
    return jsonify({"model": MODEL.gen_json_data("plotting"), "errors": MODEL.errors, "model_coefs": MODEL.coefs_()})


@app.route('/api/alpha/<alpha>')
def update_alpha(alpha):
    try:
        alpha = float(alpha)
    except ValueError:
        alpha = 1.0
    MODEL.update_alpha(alpha)
    return jsonify({"model": MODEL.gen_json_data("plotting"), "errors": MODEL.errors, "model_coefs": MODEL.coefs_()})


@app.route('/api/model_type/<model_type>')
def update_model_type(model_type):
    MODEL.update_model_type(model_type)
    return jsonify({"model": MODEL.gen_json_data("plotting"), "errors": MODEL.errors, "model_coefs": MODEL.coefs_()})


@app.route('/api/normalize/<normalize>')
def update_normalize(normalize):
    MODEL.update_normalize(normalize == 'true')
    return jsonify({"model": MODEL.gen_json_data("plotting"), "errors": MODEL.errors, "model_coefs": MODEL.coefs_()})



if __name__ == '__main__':
    app.run()
