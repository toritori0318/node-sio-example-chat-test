/**
 * Module dependencies.
 */

var express = require('express')
  , stylus = require('stylus')
  , nib = require('nib')
  , sio = require('socket.io');

// session
var RedisStore = require('connect-redis')(express)
  , sessionStore = new RedisStore()
  , parseCookie = require('connect').utils.parseCookie;

/**
 * App.
 */

// app を外部からでもアクセスできるように
var app = module.exports = express.createServer();

/**
 * App configuration.
 */

app.configure(function () {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({
      secret: 'YOURSOOPERSEKRITKEY',
      store: sessionStore
  }));
  app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }));
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname);
  app.set('view engine', 'jade');

  function compile (str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  };
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// 環境変数でcookie名を変更
var header_cookiename = 'cookie';
app.configure('test', function(){
  header_cookiename = 'x-set-cookie';
});

app.configure('production', function(){
});

/**
 * App routes.
 */

app.get('/', function (req, res) {
  var nickname = req.session.nickname;
  if(nickname) {
    res.render('index', { layout: false });
  } else {
    res.redirect('/login')
  }
});

app.get('/login', function (req, res) {
  var nickname = req.param('nick');
  if(nickname) {
    req.session.nickname = nickname;
    res.redirect('/')
  } else {
    res.render('login', { layout: false });
  }
});

app.get('/logout', function (req, res) {
  if (req.session) {
    req.session.nickname = null;
    res.clearCookie('connect.sid');
    req.session.destroy(function() {});
  }
  res.redirect('/login');
});

/**
 * App listen.
 */

// テスト時には起動しないように
if (!module.parent) {
  app.listen(3000, function () {
    var addr = app.address();
    console.log('   app listening on http://' + addr.address + ':' + addr.port);
  });
}

/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
  , nicknames = {};

io.configure(function() {
  // auth
  io.set('authorization', function (data, callback) {
    var header_cookie = data.headers[header_cookiename];
    if (!header_cookie) return callback('cookie not found.', false);

    var cookie = parseCookie(header_cookie);
    sessionStore.get(cookie['connect.sid'], function(err, session) {
      if (err || !session) {
          callback('Error', false);
      } else {
          data.session = session;
          callback(null, true);
      }
    });
  });
});

// connection
io.sockets.on('connection', function (socket) {
  var nick = socket.handshake.session.nickname

  nicknames[nick] = socket.nickname = nick;
  socket.broadcast.emit('announcement', nick + ' connected');
  io.sockets.emit('nicknames', nicknames);

  socket.on('user message', function (msg) {
    socket.broadcast.emit('user message', socket.nickname, msg);
  });

  socket.on('disconnect', function () {
    if (!socket.nickname) return;

    delete nicknames[nick];
    socket.broadcast.emit('announcement', socket.nickname + ' disconnected');
    socket.broadcast.emit('nicknames', nicknames);
  });
});
