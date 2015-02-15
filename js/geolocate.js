;
(function(exports) {
    "use strict";

    var GeoRouter = Backbone.Router.extend({
        routes: {
            '': 'index',
            'here/:name': 'here',
        },

        index: function() {
            console.log(this);
            this.navigate('here/currently', {
                trigger: true,
                replace: true
            });
        },

        here: function(name) {
            weatherView.options.view = name;
            weatherView.trigger('changeView');
        },

        initialize: function() {
            Backbone.history.start();
            weatherModel.geofetch();
        }
    });

    // geolocate model
    Backbone.GeoModel = Backbone.Model.extend({
        geo: function() {
            // geolocation -- parameters: success-callback, fail-callback, options-object

            var x = $.Deferred(),
                self = this,
                options = {
                    timeout: 10000,
                    maximumAge: 600000
                },
                // set location & prevent event triggering
                success = function(position) {
                    self.set('position', position, {
                        silent: true
                    });
                    x.resolve(position);
                },
                fail = function(e) {
                    self.set('error', e);
                    x.fail(e);
                };
            navigator.geolocation.getCurrentPosition(success, fail, options);
            return x;
        },

        // get location, then data
        geofetch: function() {
            return this.geo().then(this.fetch.bind(this));
        },

        initialize: function() {
            var self = this;
        }
    });


    // weather model
    Backbone.WeatherModel = Backbone.GeoModel.extend({
        // data url
        url: function() {
            return ['https://api.forecast.io/forecast/',
                this.get('api_key'),
                '/',
                this.get('position').coords.latitude + ',' + this.get('position').coords.longitude,
                '?callback=?'
            ].join('');
        }
    });


    // weather view
    Backbone.WeatherView = Backbone.View.extend({
        // template cache, keys as template location, values as templating function
        cache: {},

        // get & cache template
        template: function(file) {
            return this.loadTemplate('./templates/' + file + '.html');
        },

        loadTemplate: function(path) {
            var x = $.Deferred();
            if (this.cache[path]) {
                x.resolve(this.cache[path]);
            } else {
                $.get(path).then(function(a) {
                    this.cache[path] = _.template(a);
                    x.resolve(_.template(a));
                }.bind(this));
            }
            return x;
        },

        windDirection: function() {
            console.log('get wind direction');
            // give bearing empty default if windBearing not defined
            var bearing = this.model.attributes.currently ? this.model.attributes.currently.windBearing : '';
            var dir = '';

            // object keys are direction, values are 2 item array of minimum bearing and maximum bearing
            var directions = {
                'N': [0, 11.25],
                'NNE': [11.25, 33.75],
                'NE': [33.75, 56.25],
                'ENE': [56.25, 78.75],
                'E': [78.75, 101.25],
                'ESE': [101.25, 123.75],
                'SE': [123.75, 146.25],
                'SSE': [146.25, 168.75],
                'S': [168.75, 191.25],
                'SSW': [191.25, 213.75],
                'SW': [213.75, 236.25],
                'WSW': [236.25, 258.75],
                'W': [258.75, 281.25],
                'WNW': [281.25, 303.75],
                'NW': [303.75, 326.25],
                'NNW': [326.25, 348.75],
                'N ': [348.75, 360]
            };

            // for each key, check if bearing falls between numbers in array, if so set Model's windDirection to key
            for (var key in directions) {
                if (bearing > directions[key][0] && bearing <= directions[key][1]) {
                    dir = [key, this.model.attributes.currently.windBearing];
                    break;
                }
            }
            // set & prevent event triggering
            this.model.set('windDirection', dir, {
                silent: true
            });
        },

        // render
        render: function() {
            // get template, calc wind direction, then render w/ template
            var self = this;
            console.log(this);
            this.template(this.options.view)
                .done(function() {
                    // if no wind direction on model or wind direction is old (not model's wind bearing)
                    var modelAttr = self.model.attributes;
                    if (!modelAttr.windDirection || modelAttr.windDirection[1] !== modelAttr.currently.windBearing) {
                        console.log(self);
                        self.windDirection();
                    }
                })
                .done(function(templateFn) {
                    console.log(self.model.toJSON());
                    self.model && (self.el.innerHTML = templateFn({
                        data: self.model.toJSON()
                    }));
                });
        },

        // initialize
        initialize: function(options) {
            // cache unaltered options in View & add events
            this.options = options;
            // render when Model changes
            this.model && this.model.on('change', this.render, this);
            this.on('changeView', this.render, this);
        }
    });

    window.weatherModel = new Backbone.WeatherModel({
        api_key: '95608130b5e2ae64c7a9fddc6cc50f5e'
    });

    window.weatherView = new Backbone.WeatherView({
        view: '',
        model: weatherModel,
        el: 'main'
    });

    window.geoRouter = new GeoRouter();

})(typeof module === 'object' ? module.exports : window);
