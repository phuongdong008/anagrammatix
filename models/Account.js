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

        var user = new Account({
            username: username,
            password: password,
            displayName: displayName,
            avatarLink: 'http://s18.postimg.org/u7gq1zss9/avatar_default.jpg',
            caption: 'Join me, we will have fun time'
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
        setGameId: setGameId,
        Account: Account
    }
}

