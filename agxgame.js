var io;
var gameSocket;
var db;

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket, database){
    io = sio;
    gameSocket = socket;
    db = database;

    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
//    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
//    gameSocket.on('playerLogin', playerLogin);
//    gameSocket.on('playerRegister', playerRegister);
    gameSocket.on('userCreateGame', userCreateGame);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
//function hostCreateNewGame() {
//    console.log('host created new game');
//    // Create a unique Socket.IO Room
//    var thisGameId = ( Math.random() * 100000 ) | 0;
//
//    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
//    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});
//
//    // Join the Room and wait for the players
//    this.join(thisGameId.toString());
//};

function userCreateGame(data) {
    console.log('user ' + this.id + ' created new game ');
    db.createGame(data.userId);
    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.broadcast.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id, playerName: data.userName, userId: data.userId});

    //Save game information into database
    db.createGame({gameId: thisGameId + "_" + this.id, userId: data.userId});
    // Join the Room and wait for the players
    this.join(thisGameId.toString());
};

/*
 * Two players have joined. Alert the host!
 * @param data contains {gameId}
 */
function hostPrepareGame(data) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : data.gameId
    };
    //console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    sendWord(0,gameId);
};

/**
 * A player answered correctly. Time for the next word.
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextRound(data) {
    if(data.round < wordPool.length ){
        // Send a new set of words back to the host and players.
        sendWord(data.round, data.gameId);
    } else {
        // If the current round exceeds the number of words, send the 'gameOver' event.
        io.sockets.in(data.gameId).emit('gameOver',data);
    }
}
/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */
/**
 * A player clicked the 'LOGIN' button.
 * @param data
 */
function playerLogin(data) {
//    console.log('login');
    db.login(data.username,data.password,function(success){
        if (!success){
            io.sockets.emit('loginFail',data);
            console.log('login fail');
            return;
        }
        console.log('login succeed');
        io.sockets.emit('loginPass',data);
    });
}

/**
 * A player clicked the 'Register' button.
 * @param data
 */
function playerRegister(data) {
    db.register(data.username,data.password);
}

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {
    console.log('Player ' + data.playerName + ' attempting to join game: ' + data.gameId + ' socketId: ' + data.mySocketId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        this.join(data.gameId);

        console.log('Player ' + data.playerName + ' joining game: ' + data.gameId + ' socketId: ' + this.id);

        //Change status from create_game to playing
        db.playing(data);

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}

/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
    // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

    // The player's answer is attached to the data object.  \
    // Emit an event with the answer so it can be checked by the 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
    // console.log('Player: ' + data.playerName + ' ready for new game.');

    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

/**
 * Get a word for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
function sendWord(wordPoolIndex, gameId) {
    var data = getWordData(wordPoolIndex);
    io.sockets.in(data.gameId).emit('newWordData', data);
}

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(i){
    // Randomize the order of the available words.
    // The first element in the randomized array will be displayed on the host screen.
    // The second element will be hidden in a list of decoys as the correct answer
    var words = shuffle(wordPool[i].words);

    // Randomize the order of the decoy words and choose the first 5
    var decoys = shuffle(wordPool[i].decoys).slice(0,5);

    // Pick a random spot in the decoy list to put the correct answer
    var rnd = Math.floor(Math.random() * 5);
    decoys.splice(rnd, 0, words[1]);

    // Package the words into a single object.
    var wordData = {
        round: i,
        word : words[0],   // Displayed Word
        answer : words[1], // Correct Answer
        list : decoys      // Word list for player (decoys and answer)
    };

    return wordData;
}

/*
 * Javascript implementation of Fisher-Yates shuffle algorithm
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/**
 * Each element in the array provides data for a single round in the game.
 *
 * In each round, two random "words" are chosen as the host word and the correct answer.
 * Five random "decoys" are chosen to make up the list displayed to the player.
 * The correct answer is randomly inserted into the list of chosen decoys.
 *
 * @type {Array}
 */
var wordPool = [
    {
        "words"  : [ "sale","seal","ales","leas" ],
        "decoys" : [ "lead","lamp","seed","eels","lean","cels","lyse","sloe","tels","self" ]
    },

    {
        "words"  : [ "item","time","mite","emit" ],
        "decoys" : [ "neat","team","omit","tame","mate","idem","mile","lime","tire","exit" ]
    }
//    ,
//
//    {
//        "words"  : [ "spat","past","pats","taps" ],
//        "decoys" : [ "pots","laps","step","lets","pint","atop","tapa","rapt","swap","yaps" ]
//    },
//
//    {
//        "words"  : [ "nest","sent","nets","tens" ],
//        "decoys" : [ "tend","went","lent","teen","neat","ante","tone","newt","vent","elan" ]
//    },
//
//    {
//        "words"  : [ "pale","leap","plea","peal" ],
//        "decoys" : [ "sale","pail","play","lips","slip","pile","pleb","pled","help","lope" ]
//    },
//
//    {
//        "words"  : [ "races","cares","scare","acres" ],
//        "decoys" : [ "crass","scary","seeds","score","screw","cager","clear","recap","trace","cadre" ]
//    },
//
//    {
//        "words"  : [ "bowel","elbow","below","beowl" ],
//        "decoys" : [ "bowed","bower","robed","probe","roble","bowls","blows","brawl","bylaw","ebola" ]
//    },
//
//    {
//        "words"  : [ "dates","stead","sated","adset" ],
//        "decoys" : [ "seats","diety","seeds","today","sited","dotes","tides","duets","deist","diets" ]
//    },
//
//    {
//        "words"  : [ "spear","parse","reaps","pares" ],
//        "decoys" : [ "ramps","tarps","strep","spore","repos","peris","strap","perms","ropes","super" ]
//    },
//
//    {
//        "words"  : [ "stone","tones","steno","onset" ],
//        "decoys" : [ "snout","tongs","stent","tense","terns","santo","stony","toons","snort","stint" ]
//    }
]