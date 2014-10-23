module.exports = function(mongoose){
    var AccountSchema = new mongoose.Schema({
        username: {type: String, unique: true},
        password: {type: String}
    });

    var Account = mongoose.model('Account', AccountSchema);

//    var registerCallback = function(err){
//        if (err){
//            console.log(err);
//        };
//        return console.log('Account is created');
//    }

    var login = function(username,password,callback){
        Account.findOne({username:username, password:password}, function (err,doc) {
            callback(doc != null);
        })
    }

    var register = function(username,password,req){
        console.log('Registering ' + username);

        var user = new Account({
            username: username,
            password: password
        });

        user.save(function (err, doc) {
            if (err){
                console.log(err);
            };
            req.session.accountId = doc._id;
            console.log('id ' + req.session.accountId);
            return console.log('Account is created');
        });
        console.log('User ' + username + ' created');
    }

    return {
        register: register,
        login: login,
        Account: Account
    }
}

