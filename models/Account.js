module.exports = function(mongoose){
    var AccountSchema = new mongoose.Schema({
        username: {type: String, unique: true},
        password: {type: String},
        displayName: {type: String},
        avatarLink:  {type: String},
        caption: {type: String},
        status: {type: String},
        gameId: {type: String}
    });

    var Account = mongoose.model('Account', AccountSchema);

    var onlineList = function(callback){
        Account.find({status: { $ne: 'offline'}} , function (err, docs){
            callback(docs);
        });
    }

    var login = function(username,password,callback){
        Account.findOne({username:username, password:password}, function (err,doc) {
            callback(doc);
        })
    }

    var register = function(username,password,displayName,callback){
        console.log('Registering ' + username);
        var avatarLinks = [
            "http://s22.postimg.org/j2t9vfeql/image.jpg",
            "http://s22.postimg.org/u8wrnv3od/image.jpg",
            "http://s22.postimg.org/xr8rk94kd/image.png",
            "http://s22.postimg.org/ekvkh2o2l/image.png",
            "http://s22.postimg.org/rz41zd5ct/image.jpg",
            "http://s22.postimg.org/8ca8nhqhp/image.jpg",
            "http://s22.postimg.org/4v86kirfh/image.jpg",
            "http://s22.postimg.org/rvetwup99/image.jpg",
            "http://s22.postimg.org/8vfbwrhwd/image.jpg"];

        var captions = [
            "Join me, we will have fun time",
            "I am available, challenge with me",
            "Fight and make friend",
            "It is hard to be winner",
            "Have a nice day",
            "I want to fight someone"
        ];
        var user = new Account({
            username: username,
            password: password,
            displayName: displayName,
            avatarLink: avatarLinks[Math.floor(Math.random()*avatarLinks.length)],
            caption: captions[Math.floor(Math.random()*captions.length)]
        });

        user.save(function (err, doc) {
            callback(doc);
            traceError ('Register: ', err);
        });

    }


    var setStatus = function (username, status){
        Account.update({username: username}, {status: status}, function(err,doc){
            traceError ('Set status: ', err);
        })
    }

    var setStatusAllUsers = function (status){
        Account.update({}, {status: status}, { multi: true }, function(err,doc){
            traceError ('Set status: ', err);
        })
    }

    var setGameId = function (username, gameId){
        Account.update({username: username}, {gameId: gameId}, function(err,doc){
            traceError ('Set game id: ', err);
        })
    }

    var traceError = function(tag, err){
        if (err != null){
            console.log(tag + ': ' + err);
        }
    }

    return {
        onlineList: onlineList,
        register: register,
        login: login,
        setStatus: setStatus,
        setStatusAllUsers: setStatusAllUsers,
        setGameId: setGameId,
        Account: Account
    }
}

