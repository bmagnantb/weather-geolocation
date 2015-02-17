;
(function(exports) {
    "use strict";

    var GeoRouter = Backbone.Router.extend({
        routes: {
            '': 'index',
            'here/:name': 'here',
            ':city/:name': 'city'
        },

        index: function() {
            this.navigate('here/currently', {
                trigger: true,
                replace: true
            });
        },

        here: function(name) {
            locationModel.set('location', geoWeatherModel.get('city'));
            geoWeatherModel.set('view', name);
        },

        city: function(city, name) {
            if (!cities.models[city]) {
                cities.models[city] = new Backbone.WeatherModel({
                    weatherApiKey: '95608130b5e2ae64c7a9fddc6cc50f5e',
                    citysearch: city
                });
                cities.views[city] = new Backbone.WeatherView({
                    model: cities.models[city],
                    el: 'main'
                });
                cities.models[city].set('view', name);
            } else {
                if (cities.models[city].get('view') === name) {
                    cities.models[city].set('view', '');
                }
                cities.models[city].set('view', name);
            }
        },

        initialize: function() {
            Backbone.history.start();
            geoWeatherModel.geoFetch();
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
            this.geo().done(this.getCity.bind(this)).done(this.fetch.bind(this));
        },

        initialize: function() {
        	this.set('citysearch', 'here');
        },

        // find city name from geolocate coordinates, set on model
        getCity: function() {
            var self = this;
            $.get(this.cityUrl()).then(function(data) {
                var city = self.findName(data.results);
                self.set('city', city);
                console.log(self.get('city'));
            });
        },

        //look for 'locality' in google maps response -- designates city, then admin level 1 for state
        findName: function(data) {
            var result = [];
            data.forEach(function(val, ind, arr) {
                (val.types[0] === 'locality') ? result.push(val.address_components[0].long_name): null;
                (val.types[0] === 'administrative_area_level_1') ? result.push(val.address_components[0].long_name): null;
                (val.types[0] === 'country') ? result.push(val.address_components[0].long_name) : null;
            });
            return result.join(', ');
        },

        // google maps api for reverse geocoding
        cityUrl: function() {
            return ['https://maps.googleapis.com/maps/api/geocode/json?latlng=',
                this.get('position').coords.latitude + ',' + this.get('position').coords.longitude,
                '&key=AIzaSyCBkE7k5QfCESrxwB1Fr-3deOAada5QoCE&callback=?'
            ].join('');
        }
    });


    // weather model
    Backbone.WeatherModel = Backbone.Model.extend({
        initialize: function() {
            console.log(this);
            this.getCoords(this.get('citysearch'));
        },

        // data url
        url: function() {
            return ['https://api.forecast.io/forecast/',
                this.get('weatherApiKey'),
                '/',
                this.get('position').coords.latitude + ',' + this.get('position').coords.longitude,
                '?callback=?'
            ].join('');
        },

        getCoords: function() {
            var self = this;
            $.get(this.coordsUrl()).then(function(data) {
            	console.log(data.results[0].address_components);
            	console.log(self.cityName(data.results[0].address_components));
                locationModel.set('location', self.cityName(data.results[0].address_components));
                var result = {
                    coords: {
                        latitude: data.results[0].geometry.location.lat,
                        longitude: data.results[0].geometry.location.lng
                    }
                };
                self.set('position', result);
            }).done(this.fetch.bind(this));
        },

        coordsUrl: function() {
            return ['https://maps.googleapis.com/maps/api/geocode/json?components=locality:',
                this.get('citysearch'),
                '&key=AIzaSyCBkE7k5QfCESrxwB1Fr-3deOAada5QoCE&callback=?'
            ].join('');
        },

        cityName: function(data) {
            var result = [];
            data.forEach(function(val, ind, arr) {
                (val.types[0] === 'locality') ? result.push(val.long_name): null;
                (val.types[0] === 'administrative_area_level_1') ? result.push(val.long_name): null;
                (val.types[0] === 'country') ? result.push(val.long_name) : null;
            });
            return result.join(', ');
        },

        // get wind directions during fetch
        parse: function(response, options) {
            response = this.windDirection(response);
            response = this.convertTimes(response);
            return {
                weather: response
            };
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
                        var newkey = key.substr(0, key.toLowerCase().indexOf('time')) + 'Hour';
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
                time = [hours + 12, 'a'];
            } else if (hours === 12) {
                time = [hours, 'p'];
            } else if (hours > 12) {
                time = [hours - 12, 'p'];
            } else {
                time = [hours, 'a'];
            }
            // time.splice(1, 0, ':', minutes, ' ');
            return time.join('');
        }
    });

    // geolocated weather Model
    Backbone.GeoWeatherModel = Backbone.WeatherModel.extend(Backbone.GeoModel.prototype);

    // weather view
    Backbone.WeatherView = Backbone.View.extend({
        cache: {},

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
            var self = this;
            this.template(this.model.get('view'))
                .done(function(templateFn) {
                    console.log(self.model.toJSON());
                    self.model && (self.el.innerHTML = templateFn({
                        data: self.model.toJSON()
                    }));
                });
        },

        // initialize
        initialize: function(options) {
            this.options = options;
            this.listenTo(this.model, 'change:weather change:view', this.render);
        }
    });

    // view for displaying weather location
    Backbone.LocationView = Backbone.View.extend({
        render: function() {
            this.el.innerHTML = this.model.get('location');
        },

        initialize: function(options) {
            this.options = options;
            this.listenTo(this.model, 'change:location', this.render);
        }
    });

    // all weathermodels push location to this model
    window.locationModel = new Backbone.Model();

    window.locationView = new Backbone.LocationView({
        model: locationModel,
        el: '.location'
    });

    window.geoWeatherModel = new Backbone.GeoWeatherModel({
        weatherApiKey: '95608130b5e2ae64c7a9fddc6cc50f5e'
    });

    window.weatherView = new Backbone.WeatherView({
        model: geoWeatherModel,
        el: 'main'
    });

    window.cities = {
        models: {},
        views: {}
    };

    window.geoRouter = new GeoRouter();

    document.querySelector('.search input').addEventListener('keydown', function(e) {
        if (e.keyCode === 13) {
            geoRouter.navigate(this.value.replace(' ', '%20')+'/currently', {
                trigger: true
            });
        }
    });

})(typeof module === 'object' ? module.exports : window);
