var io;
var gameSocket;
var account;

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket, models){
    io = sio;
    gameSocket = socket;
    account = models.account;

    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
    gameSocket.on('userCreateGame', userCreateGame);
    gameSocket.on('unSubscribe', playerUnSubscribe);
    gameSocket.on('reJoinMyRoom', reJoinMyRoom);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

function userCreateGame(data) {
    console.log('User with player id (socket id): ' + this.id + ' created new game ');

    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;
    data.gameId = thisGameId;
    data.playerId = this.id;
    data.status = 'available';

    // Return the Room ID (gameId) and playerID (socketId) to the browser client
    this.emit('newGameCreated', data);

    // Notify to all online users about the appearance of this user.
    this.broadcast.emit('userOnline', data);

    //Save game information into database
    account.setGameId(data.userName, thisGameId);
    account.setStatus(data.userName, data.status);

    // Join the Room and wait for the players
    this.join(thisGameId.toString());

    console.log('User: ' + data.userName + ' join room ' + thisGameId);
};

/*
 * Two players have joined. Alert the host!
 * @param data contains {gameId}
 */
function hostPrepareGame(data) {
    //Change status of all players to playing.
    var players = data.listPlayers;
    for (var i = 0; i < players.length; i++){
        players[i].status = 'playing';
        account.setStatus(players[i].userName, 'playing');
    }

    this.broadcast.emit('changeStatus', players);

    io.sockets.in(data.gameId).emit('beginNewGame', data);
    console.log("All Players Present. Preparing game... room: " + data.gameId);
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
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {
    var user = data.userData;
    console.log('Player ' + user.userName + ' attempting to join game: ' + data.gameId + ' socketId (playerId): ' + user.playerId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){

        // Join the room
        this.join(data.gameId);

        console.log('Player ' + user.userName + ' joining game: ' + data.gameId + ' socketId (playerId): ' + this.id);

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

    // Emit the player's data back to the clients in the game room.
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
}

/*
 * This function haven't been used yet. Maybe in the future.
 */
function playerUnSubscribe(room){
    this.leave(room);
}

function reJoinMyRoom(userData){
    this.join(userData.gameId);
    this.broadcast.emit('changeStatus', [userData]);
    account.setStatus(userData.userName, userData.status);
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
    io.sockets.in(gameId).emit('newWordData', data);
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