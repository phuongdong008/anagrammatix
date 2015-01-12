// Import the Express module
var express = require('express');

// Import the 'path' module (packaged with Node.js)
var path = require('path');

// Create a new instance of Express
var app = express();

// Import the Anagrammatix game file.
var agx = require('./agxgame');

// Create a Node.js based http server on port 8000
var server = require('http').createServer(app).listen(8000);

// Create a Socket.IO server and attach it to the http server
var io = require('socket.io').listen(server);
var socketId;
var user;
var onlineList = [];

// Reduce the logging output of Socket.IO
io.set('log level',1);

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/anagram');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', function(){
    console.log('database connected');
});

var Account = require('./models/Account')(mongoose);
var models = {account: Account};

// When the server starts or restarts, make sure that all users status are offline.
Account.setStatusAllUsers('offline');

// We define the key of the cookie containing the Express SID
var EXPRESS_SID_KEY = 'express.sid';

// We define a secret string used to crypt the cookies sent by Express
var COOKIE_SECRET = '1234567890QWERTY';

var cookieParser = express.cookieParser(COOKIE_SECRET);

// Create a new store in memory for the Express sessions
var sessionStore = new express.session.MemoryStore();

// Create a simple Express application
app.configure(function() {
    // For Post request
    app.use(express.urlencoded());
    app.use(express.json());

    // Turn on session
    app.use(cookieParser);
    app.use(express.session({
        store: sessionStore,
        cookie: {
            httpOnly: true
        },
        key: EXPRESS_SID_KEY
    }));

    // Serve static html, js, css, and image files from the 'public' directory
    app.use(express.static(path.join(__dirname,'public')));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');

});

// Route handler
app.get('/login',function(req,res){
    res.sendfile('views/login.html');
});

app.get('/', function(req, res) {
    user = req.session.user;
    if (!user)
        res.redirect('/login');
    else {
        Account.onlineList(function(docs){
            onlineList = docs;
            res.render('index', {onlineList: onlineList, user: user });
        });
    }
});

app.get('/register',function(req,res){
    res.sendfile('views/register.html');
});

app.post('/register',function(req, res) {
    var username = req.body.username;
    var pwd = req.body.password;
    var pwd2 = req.body.password2;
    var displayName = req.body.displayName;

    if ( null == username || null == pwd || displayName == null || pwd !== pwd2){
        res.redirect('/register');
    }else{
        Account.register(username, pwd, displayName, function(doc){
            if (doc == null) { // Document returned from db.save() query
                console.log('register error: ' + username);
                res.redirect('/register');
            }else {
                req.session.user = doc;
                res.redirect('/');
            }
        });

    }
});

app.get('/logout',function(req,res) {
    user = req.session.user;
    if (user){
        Account.setStatus(user.username, 'offline');
        req.session.user = null;
        res.redirect('/login');
    }
});

app.get('/kick_out',function(req,res) {
    user = req.session.user;
    if (user){
        req.session.user = null;
        res.redirect('/login');
    }
});

app.post('/login',function(req, res) {
    var username = req.body.username;
    var pwd = req.body.password;

    if ( null == username || null == pwd){
        res.redirect('/login');
    }else{
        Account.login(username, pwd, function(doc){
            if (doc == null) {  // Document returned from db.save() query
                console.log('login error: ' + username);
                res.redirect('/login');
            }else {
                user = req.session.user = doc;
                res.redirect('/');
            }
        });

    }
});

// Listen for Socket.IO Connections. Once connected, start the game logic.
io.sockets.on('connection', function (socket) {
    user = socket.handshake.session.user;

    if (user != null) {
        user.status = 'online';
        onlineList.push(user);
        Account.setStatus(user.username, 'online');

        console.log(user.username + ' connected');
        printObject('onlineList: ', onlineList);
    }

    socketId = socket.id;

    agx.initGame(io, socket, models);

    socket.on('disconnect', function() {
        user = socket.handshake.session.user;

        if (user != null) {
            socket.broadcast.emit('userOffline', {user: user});
            Account.setStatus(user.username, 'offline');
            removeElement(onlineList, user);

            console.log(user.username + ' disconnected');
            printObject('onlineList: ', onlineList);
        }

        else {
            console.log('user == null in disconnect');
        }

    });
});


// We configure the socket.io authorization handler (handshake)
io.set('authorization', function (data, callback) {

    if(!data.headers.cookie) {

        return callback('No cookie transmitted.', false);

    }

    // We use the Express cookieParser created before to parse the cookie

    // Express cookieParser(req, res, next) is used initially to parse data in "req.headers.cookie".

    // Here our cookies are stored in "data.headers.cookie", so we just pass "data" to the first argument of function

    cookieParser(data, {}, function(parseErr) {

        if(parseErr) { return callback('Error parsing cookies.', false); }

        // Get the SID cookie

        var sidCookie = (data.secureCookies && data.secureCookies[EXPRESS_SID_KEY]) ||

            (data.signedCookies && data.signedCookies[EXPRESS_SID_KEY]) ||

            (data.cookies && data.cookies[EXPRESS_SID_KEY]);

        // Then we just need to load the session from the Express Session Store

        sessionStore.load(sidCookie, function(err, session) {

            // And last, we check if the used has a valid session and if he is logged in

            if (err || !session || !session.user) {

                callback('Not logged in.', false);

            } else {

                // If you want, you can attach the session to the handshake data, so you can use it again later

                // You can access it later with "socket.handshake.session"

                data.session = session;

                callback(null, true);

            }

        });

    });

});


// Some utils functions which need to be moved later.
var removeElement = function (array, element){
    var index = array.indexOf(element);
    if (index > -1){
        array.splice(index, 1);
    }
}

var printObject = function(tag, object){
    console.log(tag + " :" + JSON.stringify(object, null, 4));
}