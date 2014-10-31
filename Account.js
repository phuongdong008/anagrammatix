module.exports = function(mongoose){
    var AccountSchema = new mongoose.Schema({
        username: {type: String, unique: true},
        password: {type: String},
        online: {type: Boolean}
    });

    var Account = mongoose.model('Account', AccountSchema);

//    var registerCallback = function(err){
//        if (err){
//            console.log(err);
//        };
//        return console.log('Account is created');
//    }

    var online = function(username){
        Account.update({username: username}, {online: true}, {upsert: true}, function(err){
//            console.log('online: ' + err );
        });
    }

    var offline = function(username){
        Account.update({username: username}, {online: false}, {upsert: true}, function(err){
//            console.log('offline: ' + err );
        });
    }

    var login = function(username,password,callback){
        Account.findOne({username:username, password:password}, function (err,doc) {
//            console.log(username + ' Logging/ ' + 'doc ' + doc );
            callback(doc);
        })
    }

    var register = function(username,password,callback){
        console.log('Registering ' + username);

        var user = new Account({
            username: username,
            password: password,
            online: true
        });

        user.save(function (err, doc) {
            callback(doc);
            console.log('err: ' + err);
        });

    }

    var onlineList = function(userId,callback){
        console.log('Get online list');
        list = Account.find({online: true})
                        .where('_id')
//                        .ne(userId)
                        .find(function(err,docs){
//                            console.log('err ' + err + ' list: ' + docs);
                            callback(docs);
                        });
    }

    return {
        online: online,
        offline: offline,
        onlineList: onlineList,
        register: register,
        login: login,
        Account: Account
    }
}

