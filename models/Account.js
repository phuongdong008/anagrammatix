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

    var onlineList = function(usernameList, callback){
        Account.find({username: {$in : usernameList}} , function (err, docs){
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
            caption: 'Join me, we will have fun time',
            status: ''
        });

        user.save(function (err, doc) {
            callback(doc);
            console.log('err: ' + err);
        });

    }


    var createGame = function(data){
        Account.update({_id: data.userId}, {status: 'create_game', gameId: data.gameId}, function(err,doc){
        })
    }

    var playing = function(data){
        Account.update({username: data.playerName}, {status: 'playing'}, function(err,doc){
            console.log('err: ' + err);
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
        createGame: createGame,
        playing: playing,
        Account: Account
    }
}

