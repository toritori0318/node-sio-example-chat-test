var assert = require('assert')
  , tobi = require('tobi')
  , sinon = require('sinon')
  , async = require('async')
  , helper = require('./support/helper')

// test
describe('basicテスト', function() {

  var usersocket = {};
  var spy_A = sinon.spy()
  var spy_B = sinon.spy()

  // 初期化処理
  before(function (done) {
    // DB初期化
    helper.initDataStore(function() {
      // サーバ起動
      helper.startServer(function() {
        done();
      });
    });
  });

  it('ユーザB が send したメッセージを A が受け取り、Bは受け取らないこと', function (done) {
    async.waterfall(
      [
        function userA(callback) {
          var nickname = 'tori';
          var parameter = { nick: nickname }
          helper.login_and_clsocket(parameter, function(socket) {
            usersocket[nickname] = socket;
            socket.on('connect', function() {
              // 'user message' spy用
              socket.on('user message', spy_A);
              // 'user message' 受信テスト
              socket.on('user message', function (nickname, message) {
                  assert.equal(nickname, 'fuga')
                  assert.equal(message, 'wanwan')
              });
            });
            callback();
          });
        },
        function userB(callback) {
          var nickname = 'fuga';
          var parameter = { nick: nickname }
          helper.login_and_clsocket(parameter, function(socket) {
            usersocket[nickname] = socket;
            socket.on('connect', function() {
              // 'user message' spy用
              socket.on('user message', spy_B);
              // メッセージ送信
              socket.emit('user message', 'wanwan');
            });
            callback();
          });
        },
        function finish(callback) {
          done();
        },
      ]
    );
  });

  // すべてのテスト終了後
  after(function(done) {

    setTimeout(function () {
      // userA の 'user message'が呼び出されることをテスト
      assert.equal(true,  spy_A.calledOnce)
      // userB の 'user message'が呼び出されないことをテスト
      assert.equal(false, spy_B.called)

      // connection close
      for (var key in usersocket) {
          usersocket[key].disconnect();
      }

      done();

    }, 50);
  });

});

