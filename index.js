// Import the Express module
var express = require('express');

// Import the 'path' module (packaged with Node.js)
var path = require('path');

// Create a new instance of Express
var app = express();

var bodyParser = require('body-parser');

// Import the Anagrammatix game file.
var agx = require('./agxgame');

// Create a Node.js based http server on port 8000
var server = require('http').createServer(app).listen(8000);

// Create a Socket.IO server and attach it to the http server
var io = require('socket.io').listen(server);
var socketId;
var user;

// Reduce the logging output of Socket.IO
io.set('log level',1);

var mongoose = require('mongoose');
    mongoose.connect('mongodb://localhost/anagram');

var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error'));
    db.once('open', function(){
        console.log('database connected');
    });

var Account = require('./Account')(mongoose);

// Create a simple Express application
app.configure(function() {
    // Use POST request
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    // Turn on session
    app.use(express.cookieParser());
    app.use(express.session({secret: '1234567890QWERTY'}));

    // Turn down the logging activity
//    app.use(express.logger('dev'));

    // Serve static html, js, css, and image files from the 'public' directory
    app.use(express.static(path.join(__dirname,'public')));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');

    // Require to serve html file
    app.engine('html', require('ejs').renderFile);
});

    // Route handler
    app.get('/login',function(req,res){
        res.render('login.html');
    });

    app.get('/', function(req, res) {
        if (!req.session.accountId)
            res.redirect('/login');
        else {
            Account.onlineList(req.session.accountId, function(docs){
                var list = docs;
                user = req.session.user;
//                console.log('online list: ' + list);
                res.render('index', {username: req.session.user.username, onlineList: list, user: req.session.user });
//                res.render('index.html');
            });
        }
    });

    app.get('/main', function(req, res) {
        res.render('main.html');
    });

    app.get('/register',function(req,res){
        res.render('register.html');
    });

    app.post('/register',function(req, res) {
        var username = req.body.username;
        var pwd = req.body.password;

        if ( null == username || null == pwd){
            res.render('register.html');
        }else{
            Account.register(username,pwd,function(doc){
                if (doc == null) {                              // Document returned from db.save() query
                    console.log('register error');
                    res.render('register.html');
                }else {
                    Account.online(username);
                    req.session.accountId = doc._id;
                    user = req.session.user = doc;
                    res.redirect('/');
                }
            });

        }
    });

    app.get('/logout',function(req,res){
        if (!req.session.accountId)
            res.redirect('/login');
        else {
            user = req.session.user;
//            console.log('username '+ user.username + ' log out');
            Account.offline(user.username);
            req.session.accountId = null;
            req.session.user = null;
            res.redirect('/');
        }
    });

    app.post('/login',function(req, res) {
        var username = req.body.username;
        var pwd = req.body.password;

        if ( null == username || null == pwd){
            res.render('login.html');
        }else{
            Account.login(username,pwd,function(doc){
                if (doc == null) {                              // Document returned from db.save() query
                    console.log('login error');
                    res.render('login.html');
                }else {
                    req.session.accountId = doc._id;
                    user = req.session.user = doc;
//                    console.log('username '+ username + ' log in');
                    Account.online(username);
                    res.redirect('/');
                }
            });

        }
    });


// Listen for Socket.IO Connections. Once connected, start the game logic.
io.sockets.on('connection', function (socket) {
    if (user != null) {
        socket.broadcast.emit('userOnline', {username: user.username, user: user});
//        console.log('socketId: ' + socket.id + '_' + user.username);
    }
    socketId = socket.id;

    agx.initGame(io, socket, Account);
    socket.on('userCreateGame', function(data){
        Account.createGame(data.userId);
    });

    socket.on('disconnect', function() {
        if (user != null) {
            socket.broadcast.emit('userOffline', {username: user.username, user: user});
//            console.log('disconect ' + socket.id);
        }

    });
});
