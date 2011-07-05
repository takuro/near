// My config

var config = {
  port: 3000,
  guest_name: "Guest",
  my_name: "You",
  near_distance: 30000.0,
}

/**
 * Module dependencies.
 */

var express = require('express'),
    io = require('socket.io'),
    mg = require('mongoose'),
    haml = require('hamljs');

var json = JSON.stringify;
var app = module.exports = express.createServer();

// mongodb
mg.connect('mongodb://localhost/location');
var Schema = mg.Schema;

var location_schema = new Schema({ id: String, lat: String, lon: String, ch: String });
var Location = mg.model('Location', location_schema);

// distance
// via : http://d.hatena.ne.jp/sato_shin/20061113/1163414997
function distance(from, to) {
  var from_x = from.x * Math.PI / 180;
  var from_y = from.y * Math.PI / 180;
  var to_x = to.x * Math.PI / 180;
  var to_y = to.y * Math.PI / 180;
  var deg = Math.sin(from_y) * Math.sin(to_y) + Math.cos(from_y) * Math.cos(to_y) * Math.cos(to_x-from_x);
  return 6378140 * (Math.atan( -deg / Math.sqrt(-deg * deg + 1)) + Math.PI / 2);
  //return Math.round(dist);
}

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'hamljs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});
app.register('.haml', require('hamljs'));

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

var socket = io.listen(app);

// Routes

app.get('/', function(req, res){
  res.render('index.haml');
});

app.post('/geo', function(req, res){
  var location_schema = new Schema({ id: String, lat: String, lon: String, ch: String });
  var Location = mg.model('Location', location_schema);
  var loc = new Location();

  if (req.body.lat && req.body.lon) {
    var lat = "" + req.body.lat;
    var lon = "" + req.body.lon;

    // get session id
    var key = "";
    for (var k in socket.clients) {
      key = k;
    }

    if (key != "") {
      var d = config.near_distance;
      var ch = null;
      Location.find({}, function(err, docs) {
        if(!err) {
          for (var i = 0; i < docs.length; i++ ) {
            d = distance({x: lat, y: lon}, {x: docs[i].lat, y: docs[i].lon})
            //console.log(d);

            if (parseInt(d) < config.near_distance) {
              console.log("find near user : " + docs[i].ch);
              ch = docs[i].ch;
            }
          }
        } else {
          console.log("no data");
        }

        loc.id = key,
        loc.lat = lat,
        loc.lon = lon,
        loc.ch = key;
        if (ch !== null) {
          console.log("find near user");
          loc.ch = ch;
        }
        loc.save(function(err) {
          if(!err) console.log(loc)
        });
      });
    }
  }
  return false;
});

app.listen(config.port);

socket.on('connection', function(client) {
  client.on('message', function(data) {
    // message
    var obj = JSON.parse(data);
    if (obj.message == "") {
    } else {
      var speaker = '<header class="speaker">' + obj.name + '</header></article>';
      var msg = '<article class="other ' + obj.name + '"><div class="bubble"><p>' + obj.message + '</p></div>';

      if (obj.name == "") {
        // for guest
        speaker = '<header class="speaker">' + config.guest_name + '</header></article>';
        msg = '<article class="bubble other"><div class="bubble"><p>' + obj.message + '</p></div>';
      }

      // for all user
      data = json({name: speaker, message: msg});

      Location.find({id: ""+client.sessionId}, function(err, doc) {
        if (!err) {
          if (typeof doc[0] != 'undefined') {
            client.joinChannel(doc[0].ch);
          }
          client.broadcastToChannel(data, doc[0].ch, client.sessionId);
        }
      });

      // for you
      /*
      speaker = '<header class="speaker">' + config.my_name + '</header></article>';
      msg = '<article class="bubble you"><div class="bubble"><p>' + obj.message + '</p></div>';
      data = json({name: speaker, message: msg});
      client.sendToMe(data, client.sessionId);
      */
    }
  });
  client.on('disconnect', function() {
    // disconnect
    Location.find({id: ""+client.sessionId}, function (err, doc) {
      if (!err && doc[0]) { doc[0].remove(); }
    });
    console.log('disconnect : ' + client.sessionId);
  });
});

console.log("Express server listening on port %d", app.address().port);

var Client  = require('socket.io/lib/socket.io/client.js');

Client.prototype.broadcastToChannel = function(message, channel, myId){
  for (var i = 0, k = Object.keys(this.listener.clients), l = k.length; i < l; i++){
    if(this.listener.clients[k[i]].channel == channel) {
    //if(this.listener.clients[k[i]].channel == channel && this.listener.clients[k[i]].sessionId != myId) {
      this.listener.clients[k[i]].send(message);
    }
  }
  return this;
};

Client.prototype.sendToMe = function(message, myId){
  for (var i = 0, k = Object.keys(this.listener.clients), l = k.length; i < l; i++){
    if(this.listener.clients[k[i]].sessionId == myId) {
      this.listener.clients[k[i]].send(message);
    }
  }
  return this;
};

// クライアントがチャンネルに入るためのメソッド
Client.prototype.joinChannel = function(channel){
  this.channel = channel;
};
