;
(function(exports) {
    "use strict";

    var GeoRouter = Backbone.Router.extend({
        routes: {
            '': 'index',
            'here/:name': 'here',
        },

        index: function() {
            this.navigate('here/currently', {
                trigger: false,
                replace: true
            });
        },

        here: function(name) {
            weatherView.options.view = name;
            weatherView.trigger('changeView');
        },

        initialize: function() {
            Backbone.history.start();
            weatherModel.geoFetch();
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

        geoFetch: function() {
            this.geo().then(this.fetch.bind(this));
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
        },

        // get wind directions during fetch
        parse: function(response, options) {
            console.log(response);
            response = this.windDirection(response);
            response = this.convertTimes(response);
            return response;
        },

        // looks for property windBearing, if found adds windDirection property to object
        windDirection: function(data) {
            var self = this;
            // if array, for each item, if array or object, run windDirection
            if (data instanceof Array) {
                data.forEach(function(val, ind, arr) {
                    (val instanceof Object || val instanceof Array) && self.windDirection(val);
                });
            }

            // if value is an object, look for windBearing key, if data[key] is object, run windDirection
            else if (data instanceof Object) {
                for (var key in data) {
                    (key === 'windBearing') ? data.windDirection = this.calcDirection(data[key]): null;
                    data[key] instanceof Object && this.windDirection(data[key]);
                }
            }

            return data;
        },

        // converts angle bearing to cardinal direction
        calcDirection: function(bearing) {
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

            // compares bearing to object numbers, gives direction
            for (var key in directions) {
                if (bearing > directions[key][0] && bearing <= directions[key][1]) {
                    return key;
                }
            }
        },

        // finds times and converts epoch time to hour am/pm
        convertTimes: function(data) {
            var self = this;
            // if array, for each item, if array or object, run convertTimes
            if (data instanceof Array) {
                data.forEach(function(val, ind, arr) {
                    (val instanceof Array || val instanceof Object) && self.convertTimes(val);
                });
            }

            // if object, check key for string 'time', if so, call this.toHours()
            else if (data instanceof Object) {
                for (var key in data) {
                    if (key.toLowerCase().indexOf('time') > -1) {
                    	var newkey = key.substr(0, key.toLowerCase().indexOf('time'))+'Hour';
                    	data[newkey] = this.toHours(data[key]);
                    }
                    (data[key] instanceof Object) && this.convertTimes(data[key]);
                }
            }

            return data;
        },

        toHours: function(time) {
            var hours = new Date(time * 1000).getHours();
            var minutes = new Date(time * 1000).getMinutes();
            if (hours === 0) {
                time = [hours + 12, 'am'];
            } else if (hours > 12) {
                time = [hours - 12, 'pm'];
            } else {
                time = [hours, 'am'];
            }
            // time.splice(1, 0, ':', minutes, ' ');
            return time.join('');
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

        // render
        render: function() {
            // get template, calc wind direction, then render w/ template
            var self = this;
            this.template(this.options.view)
                // .done(function() {
                //     self.windDirection();
                // })
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
        view: 'currently',
        model: weatherModel,
        el: 'main'
    });

    window.geoRouter = new GeoRouter();

})(typeof module === 'object' ? module.exports : window);
