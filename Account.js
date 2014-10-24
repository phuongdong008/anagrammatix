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
//            console.log(username + ' Logging/ ' + 'doc ' + doc );
            callback(doc);
        })
    }

    var register = function(username,password,callback){
        console.log('Registering ' + username);

        var user = new Account({
            username: username,
            password: password
        });

        user.save(function (err, doc) {
            callback(doc);
//            req.session.accountId = doc._id;
//            console.log('id ' + req.session.accountId);
            console.log(err);
        });

    }

    return {
        register: register,
        login: login,
        Account: Account
    }
}

