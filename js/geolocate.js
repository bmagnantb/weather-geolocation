;
(function(exports) {

    "use strict";
    // geolocate model

    Backbone.GeoModel = Backbone.Model.extend({
        geo: function() {
            // geolocation -- parameters: success-callback, error-callback, options-object

            var x = $.Deferred(),
                self = this,
                options = {
                    timeout: 10000,
                    maximumAge: 600000
                },
                success = function(position) {
                    self.set('position', position);
                    x.resolve(position);
                },
                fail = function(e) {
                    x.fail(e);
                };
            navigator.geolocation.getCurrentPosition(success, fail, options);
            return x;
        },


        geofetch: function() {
            return this.geo().then(this.fetch.bind(this));
        },


        initialize: function() {
            var self = this;
        }
    });


    // weather model
    Backbone.WeatherModel = Backbone.GeoModel.extend({
    	// url
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
        // template cache
        cache: {},

        // get template
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
            this.template(this.options.view || this.view).then(function(templateFn) {
            	console.log(self.model.toJSON());
                self.model && (self.el.innerHTML = templateFn({ data: self.model.toJSON() }));
            });
        },

        // initialize
        initialize: function(options) {
            this.options = options;
            this.model && this.model.on("change", this.render, this);
        }
    });

    var weatherModel = new Backbone.WeatherModel({
        api_key: '95608130b5e2ae64c7a9fddc6cc50f5e'
    });

    var weatherView = new Backbone.WeatherView({
        view: 'weather',
        model: weatherModel,
        el: '.weather'
    });

    weatherModel.geofetch().then(function(data) {
        console.log(weatherModel.toJSON());
    });

})(typeof module === 'object' ? module.exports : window);
