//top-message

(function(window, document, L, undefined) {

  function defaults(userSettings, defaults) {
    var settings = {},
      i;

    for (i in defaults) if (defaults.hasOwnProperty(i)) {
      settings[i] = (userSettings.hasOwnProperty(i) ? userSettings[i] : defaults[i]);
    }

    return settings;
  }

  L.glify = {
    points: function(settings) {
      return new this.Points(settings);
    },
    shapes: function(settings) {
      return new this.Shapes(settings);
    },
    // -- converts latlon to pixels at zoom level 0 (for 256x256 tile size) , inverts y coord )
    // -- source : http://build-failed.blogspot.cz/2013/02/displaying-webgl-data-on-google-maps.html
    latLonToPixelXY: function (latitude, longitude) {
      var pi_180 = Math.PI / 180.0,
        pi_4 = Math.PI * 4,
        sinLatitude = Math.sin(latitude * pi_180),
        pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (pi_4)) * 256,
        pixelX = ((longitude + 180) / 360) * 256;

      return {x: pixelX, y: pixelY};
    },
    Points: null,
    Shapes: null,
    color: {
      green: {r: 0, g: 1, b: 0},
      red: {r: 1, g: 0, b: 0},
      blue: {r: 0, g: 0, b: 1},
      teal: {r: 0, g: 1, b: 1},
      yellow: {r: 1, g: 1, b: 0},
      black: {r: 1, g: 1, b: 1},
      gray: {r: 0.5, g: 0.5, b: 0.5},
      grey: {r: 0.5, g: 0.5, b: 0.5},
      random: function () {
        return {
          r: Math.random(),
          g: Math.random(),
          b: Math.random()
        };
      },
      pallet: function () {
        switch (Math.round(Math.random() * 4)) {
          case 0:
            return L.glify.color.green;
          case 1:
            return L.glify.color.red;
          case 2:
            return L.glify.color.blue;
          case 3:
            return L.glify.color.teal;
          case 4:
            return L.glify.color.yellow;
        }
      }
    },
    mapMatrix: null,
    shader: {
      vertex: null,
      fragment: {
        dot: null,
        polygon: null
      }
    }
  };


  //node-dependencies

})(window, document, L);