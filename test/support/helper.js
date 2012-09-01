// lib
var io = require('socket.io-client')
  , tobi = require('tobi')
  , Cookie = tobi.Cookie
  , redisc = require('redis').createClient()
  , app  = require('../../app')

var port = 3001
var browser = tobi.createBrowser(port, 'localhost')

//////////////////////////////////////////////////////////////////////////////////////
// socket.ioクライアントでクッキー送信するようにhandshakeをハイジャック
var xhr_cookie;
function empty () { };
io.Socket.prototype.handshake = function (fn) {
    var self = this
      , options = this.options;

    function complete (data) {
      if (data instanceof Error) {
        self.connecting = false;
        self.onError(data.message);
      } else {
        fn.apply(null, data.split(':'));
      }
    };

    var url = [
          'http' + (options.secure ? 's' : '') + ':/'
        , options.host + ':' + options.port
        , options.resource
        , io.protocol
        , io.util.query(this.options.query, 't=' + +new Date)
      ].join('/');

    if (this.isXDomain() && !io.util.ua.hasCORS) {
      var insertAt = document.getElementsByTagName('script')[0]
        , script = document.createElement('script');

      script.src = url + '&jsonp=' + io.j.length;
      insertAt.parentNode.insertBefore(script, insertAt);

      io.j.push(function (data) {
        complete(data);
        script.parentNode.removeChild(script);
      });
    } else {
      var xhr = io.util.request();

      xhr.open('GET', url, true);
      xhr.setRequestHeader("X-Set-Cookie", xhr_cookie);
      if (this.isXDomain()) {
        xhr.withCredentials = true;
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
          xhr.onreadystatechange = empty;

          if (xhr.status == 200) {
            complete(xhr.responseText);
          } else if (xhr.status == 403) {
            self.onError(xhr.responseText);
          } else {
            self.connecting = false;
            !self.reconnecting && self.onError(xhr.responseText);
          }
        }
      };
      xhr.send(null);
    }
};
//////////////////////////////////////////////////////////////////////////////////////

// サーバ起動
function startServer (callback) {
  app.listen(port, function () {
    callback();
  });
};
process.on('exit', function () {
  app.close();
});

// データストア初期化
function initDataStore(callback) {
  redisc.flushdb(function() {
    callback();
  })
}

// ログイン処理 かつ socket.ioのコネクションを返却
function login_and_clsocket (parameter, callback) {
  browser.get('/login', function(res, $){
    $('#set-nickname')
      .fill(parameter)
      .submit(function(res, $){
        var cookies = parse_cookie(res.headers['set-cookie']);
        xhr_cookie = 'connect.sid=' + cookies['connect.sid']['value'];
        var socket = io.connect('http://localhost:' + port, {'force new connection': true });
        callback(socket);
      });
  });
};

// cookie parse
function parse_cookie (cookie_str) {
    if(!cookie_str) return {};

    var cookies = {};
    for (var i=0;i<cookie_str.length;i++) {
        var cookie = new Cookie(cookie_str[i]);
        cookies[cookie.name] = cookie;
    }
    return cookies;
}

exports.initDataStore = initDataStore;
exports.startServer = startServer;
exports.login_and_clsocket = login_and_clsocket;
exports.browser = browser;
