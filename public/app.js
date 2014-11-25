;
jQuery(function($){    
    'use strict';

//    $.get('/').done(function(data){ alert(data); });

    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
     */
    var IO = {
        /**
         * Information about user
         */
        userObject: null,

        /**
         * List users online
         */
        onlineList: null,

        /**
         * This is called when the page is displayed. It connects the Socket.IO client
         * to the Socket.IO server
         */
        init: function() {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
         * While connected, Socket.IO will listen to the following events emitted
         * by the Socket.IO server, then run the appropriate function.
         */
        bindEvents : function() {
            IO.socket.on('connected', IO.onConnected );
            IO.socket.on('newGameCreated', IO.onNewGameCreated );
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
            IO.socket.on('beginNewGame', IO.beginNewGame );
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('error', IO.error );
            IO.socket.on('userOnline', IO.userOnline );
            IO.socket.on('userOffline', IO.userOffline );
            IO.socket.on('changeStatus', IO.changeStatus );
        },

        /**
         * When user log in
         */
        userOnline : function(data) {
            var user = data;

            // Check if I am logging on multiple sessions or devices.
            if (user.userName === App.userData.userName){
                return;
            }

            $('#' + user.userId).remove();
            $('.p_nobody_online').remove();
            $('<div id="'+ user.userId +'" class="div_user_online" data-game-id="'+ user.gameId+ '" data-status="'+ user.status +'"></div>').insertAfter('#p_online_users');
            $('#' + user.userId).prepend(  '<img src="'+ user.avatarLink +'" class="user_online_img">'
                                     +  '<div class="profile_right"><p class="user_name">'+ user.userName +'</p><p class="status">'+ user.caption +'</p></div>'
                                     +  '<img class="img_status" src="resource/available_sign.png">'
            );

        },

        /**
         * When user log out
         */
        userOffline : function(data) {
            $('#' + data.user._id).remove();
        },

        /**
         * Normally, when a group begin playing, all other users will be able to see these changes
         */
        changeStatus : function (players){
            for (var i = 0; i < players.length; i++){
                var user = players[i];
                $('#' + user.userId).attr('data-status', user.status);
                if (user.status === 'available'){
                    $('#' + user.userId).find('.img_status').attr('src', 'resource/available_sign.png');
                }
                else {
                    $('#' + user.userId).find('.img_status').attr('src', 'resource/playing_sign.png');
                }
            }
        },

        /**
         * The client is successfully connected!
         */
        onConnected : function(data) {
            // Cache a copy of the client's socket.IO session ID on the App
            App.playerId = IO.socket.socket.sessionid;
        },

        /**
         * A new game has been created and a random game ID has been generated.
         * @param data {{ gameId: int, playerId: *, userId: *}}
         */
        onNewGameCreated : function(data) {
            App.Host.gameInit(data);
        },

        /**
         * A player has successfully joined the game.
         * @param data {{playerName: string, gameId: int, playerId: string}}
         */
        playerJoinedRoom : function(data) {
            // When a player joins a room, do the updateWaitingScreen function.
            // There are two versions of this function: one for the 'host' and
            // another for the 'player'.
            //
            // So on the 'host' browser window, the App.Host.updateWaitingScreen function is called.
            // And on the player's browser, App.Player.updateWaitingScreen is called.
            App.gameId = data.gameId;
            App[App.myRole].updateWaitingScreen(data);
        },

        /**
         * Both players have joined the game.
         * @param data
         */
        beginNewGame : function(data) {
            console.log('Client begin new game.');

            // Now when the game begins, all players need to know the list of players.
            App.listPlayers = data.listPlayers;

            // Before changing screen, we need to save main screen html.
            App.$mainArea.html(App.$gameArea.html());

            App.gameCountdown(data);
        },

        /**
         * A new set of words for the round is returned from the server.
         * @param data
         */
        onNewWordData : function(data) {
            // Update the current round
            App.currentRound = data.round;

            // Change the word for all players.
            App.newWord(data);
        },

        /**
         * A player answered. If this is the host, check the answer.
         * @param data
         */
        hostCheckAnswer : function(data) {
            App.checkAnswer(data);
        },

        /**
         * Let everyone know the game has ended.
         * @param data
         */
        gameOver : function(data) {
            App.endGame(data);
        },

        /**
         * An error has occurred.
         * @param data
         */
        error : function(data) {
            alert(data.message);
        }

    };

    var App = {
        /*
         * Contains username, userId, avatarLink, caption which are got from script defined in html.
         */
        userData: {},

        /**
         * Contains references to player data
         */
        listPlayers: [],

        /**
         * A reference to the correct answer for the current round.
         */
        currentCorrectAnswer: '',

        /**
         * Keep track of the gameId, which is identical to the ID
         * of the Socket.IO Room used for the players and host to communicate
         *
         */
        gameId: 0,

        /**
         * This is used to differentiate between 'Host' and 'Player' browsers.
         */
        myRole: '',   // 'Player' or 'Host'

        /**
         * The Socket.IO socket object identifier. This is unique for
         * each player and host. It is generated when the browser initially
         * connects to the server when the page loads for the first time.
         */
        playerId: '',

        /**
         * Identifies the current round. Starts at 0 because it corresponds
         * to the array of word data stored on the server.
         */
        currentRound: 0,

        currentWord : '',

        /* *************************************
         *                Setup                *
         * *********************************** */

        /**
         * This runs when the page initially loads.
         */
        init: function () {
            App.cacheElements();
            App.showMainScreen(true);
            App.bindEvents();

            // Get user data from script defined inside html. (see index.jade)
            App.userData = userData;
            App.userName = App.userData.userName;

            // After logging in, a new user will create new game at once and waiting for other
            // players can join him.
            IO.socket.emit('userCreateGame', App.userData);

            // Initialize the "Fast click" library
            FastClick.attach(document.body);
        },

        unload: function (){
            $(window).unload(function() {
                // Do something before the browser reloads.
            });
        },

        /**
         * Create references to on-screen elements used throughout the game.
         */
        cacheElements: function () {
            App.$doc = $(document);

            // Templates
            App.$gameArea = $('#gameArea');
            App.$hostGame = $('#host-game-template').html();
            App.$mainArea = $('#main-screen-template');
        },

        /**
         * Create some click handlers for the various buttons that appear on-screen.
         */
        bindEvents: function () {
            // Player
            App.$doc.on('click', '.div_user_online',App.Player.onJoinClick);
            App.$doc.on('click', '.btnAnswer',App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart);
        },

        /* *************************************
         *             Game Logic              *
         * *********************************** */

        /**
         * Show the main screen after logging in or clicking "return home".
         * @param : reload : boolean
         */
        showMainScreen: function(reload) {
            App.myRole = 'Host';

            if (!reload){
                App.joinMyself(App.userData);
            }

            App.$gameArea.html(App.$mainArea.html());
        },


        /*
         * Some data needs to be re-initialized.
         */
        joinMyself: function (data){
            App.listPlayers.length = 0;
            App.listPlayers.push(data);

            console.log(data);
            console.log("Game started with ID: " + App.gameId + ' by host: ' + data.playerId + ' user name: ' + data.userName);
        },


        /**
         * Show the countdown screen
         */
        gameCountdown : function() {
            // Prepare the game screen with new HTML
            App.$gameArea.html(App.$hostGame);
            $('#overArea').hide();
            $('#hostWord').show();

            // Begin the on-screen countdown timer
            var $secondsLeft = $('#hostWord');
            App.countDown( $secondsLeft, 5, function(){
                if (App.myRole == 'Host'){
                    IO.socket.emit('hostCountdownFinished', App.gameId);
                }
                else {
                    $('#hostWord').text(App.currentWord);
                }
            });

            // Display the players' names on screen
            $('#user_info1')
                .find('.playerName')
                .html(App.listPlayers[0].userName);

            $('#user_info2')
                .find('.playerName')
                .html(App.listPlayers[1].userName);

            // Set the Score section on screen to 0 for each player.
            $('#user_info1').find('.score').attr('id',App.listPlayers[0].playerId);
            $('#user_info2').find('.score').attr('id',App.listPlayers[1].playerId);
        },


        /**
         * Show the list of words for the current round.
         * @param data{{round: *, word: *, answer: *, list: Array}}
         */
        newWord: function (data) {
            // Insert the new word into the DOM
            $('#hostWord').text(data.word);
            App.currentWord = data.word;

            // Update the data for the current round
            App.currentCorrectAnswer = data.answer;

            $('#ulAnswers').remove();
            // Create an unordered list element
            var $list = $('<ul/>').attr('id', 'ulAnswers');

            // Insert a list item for each word in the word list
            // received from the server.
            $.each(data.list, function () {
                $list                                //  <ul> </ul>
                    .append($('<li/>')              //  <ul> <li> </li> </ul>
                    .append($('<a/>')               //  <ul> <li> <a> </a> </li> </ul>
                            .addClass('btnAnswer')   //  <ul> <li> <a class='btnAnswer'> </a> </li> </ul>
                            .val(this)               //  <ul> <li> <a class='btnAnswer' value='word'> </a> </li> </ul>
                            .html(this)              //  <ul> <li> <a class='btnAnswer' value='word'>word</a> </li> </ul>
                    )
                )
            });

            // Insert the list onto the screen.
            App.$gameArea.append($list);
        },


        /**
         * Check the answer clicked by a player.
         * @param data{{round: *, playerId: *, answer: *, gameId: *}}
         */
        checkAnswer : function(data) {
            // Verify that the answer clicked is from the current round.
            // This prevents a 'late entry' from a player whose screen has not
            // yet updated to the current round.
            if (data.round === App.currentRound){

                // Get the player's score
                var $pScore = $('#' + data.playerId);

                // Advance player's score if it is correct
                if( App.currentCorrectAnswer === data.answer ) {
                    // Add 5 to the player's score
                    $pScore.text( +$pScore.text() + 5 );

                    // Advance the round
                    App.currentRound += 1;

                    // Prepare data to send to the server
                    var data = {
                        gameId : App.gameId,
                        round : App.currentRound
                    }

                    // Notify the server to start the next round.
                    // And only the host sends this request.
                    if (App.myRole === 'Host'){
                        IO.socket.emit('hostNextRound',data);
                    }

                } else {
                    // A wrong answer was submitted, so decrement the player's score.
                    $pScore.text( +$pScore.text() - 3 );
                }
            }
        },


        /**
         * All 10 rounds have played out. End the game.
         * @param data
         */
        endGame : function(data) {
            // Get the data for player 1 from the host screen
            var $p1 = $('#user_info1');
            var p1Score = +$p1.find('.score').text();
            var p1Name = $p1.find('.playerName').text();

            // Get the data for player 2 from the host screen
            var $p2 = $('#user_info2');
            var p2Score = +$p2.find('.score').text();
            var p2Name = $p2.find('.playerName').text();

            // Find the winner based on the scores
            var winner = (p1Score < p2Score) ? p2Name : p1Name;
            var tie = (p1Score === p2Score);

            $('#ulAnswers').remove();
            // Display the winner (or tie game message)
            if(tie){
                $('#p_winner').text("It's a Tie :|");
            } else if (winner != App.userName) {
                $('#p_winner').text( winner + ' wins :(' );
            } else{
                $('#p_winner').text( 'You are winner :)' );
            }

            $('#hostWord').hide();
            $('#overArea').show();
            $('#btnHome').click(function(){
                App.showMainScreen(false);
                IO.socket.emit('reJoinMyRoom', App.userData);
            });

            // Reset game data
            App.Host.isNewGame = true;
            App.listPlayers.length = 0;
        },


        /* *******************************
           *         HOST CODE           *
           ******************************* */
        Host : {

            /**
             * Flag to indicate if a new game is starting.
             * This is used after the first game ends, and players initiate a new game
             * without refreshing the browser windows.
             */
            isNewGame : false,

            /**
             * The Host screen is displayed for the first time.
             * @param data{{ gameId: int, playerId: *, playerName: * }}
             */
            gameInit: function (data) {
                // Update the user data (gameId and playerId are added)
                App.userData = data;
                App.gameId = App.userData.gameId;

                App.joinMyself(App.userData);
            },


            /**
             * Update the Host screen when the first player joins
             * @param data{{playerName: string}}
             */
            updateWaitingScreen: function(data) {

                console.log('updateWaitingScreen host');

                // Store the new player's data on the Host.
                App.listPlayers.push(data.userData);
                var length = App.listPlayers.length;
                console.log(data.userData);
                console.log('Player: ' + App.listPlayers[length - 1].userName + ' with socket id: '+ App.listPlayers[length - 1].playerId + ' joined game');

                // If two players have joined, start the game!
                if (length === 2) {
                    console.log('Room is full. Almost ready!');

                    var data = {
                        gameId : App.gameId,
                        listPlayers: App.listPlayers
                    }
                    // Let the server know that two players are present.
                    IO.socket.emit('hostRoomFull', data);
                }
            }

        },


        /* *****************************
           *        PLAYER CODE        *
           ***************************** */

        Player : {

            /**
             * The player entered their name and gameId (hopefully)
             * and clicked Start.
             */
            onJoinClick: function () {
                var gameId = $(this).data('game-id');
                var status = $(this).data('status');

                // This means he is clicking on his profile.
                if (!gameId){
                    return;
                }

                if (status !== 'available'){
                    return;
                }

                console.log('Player clicked "Join"');
                App.myRole = 'Player';

                // Collect data to send to the server
                var data = {
                    gameId: gameId,
                    userData: App.userData
                };

                // Send the gameId and playerName to the server
                IO.socket.emit('playerJoinGame', data);
            },

            /**
             *  Click handler for the Player hitting a word in the word list.
             */
            onPlayerAnswerClick: function () {
                var $btn = $(this);      // the tapped button
                var answer = $btn.val(); // The tapped word

                // Send the player info and tapped word to the server so
                // the host can check the answer.
                var data = {
                    gameId: App.gameId,
                    playerId: App.playerId,
                    answer: answer,
                    round: App.currentRound
                };
                IO.socket.emit('playerAnswer', data);
            },

            /**
             *  Click handler for the "Start Again" button that appears
             *  when a game is over.
             */
            onPlayerRestart: function () {
                var data = {
                    gameId: App.gameId,
                    userData: App.userData
                }
                IO.socket.emit('playerRestart', data);
                App.currentRound = 0;
                $('#p_winner').html("Waiting for others...");
                $('#btnPlayerRestart').hide();
            },

            /**
             * Display the waiting screen for player 1
             * @param data
             */
            updateWaitingScreen: function (data) {
                console.log('updateWaitingScreen player');
            }

        },
        /* **************************
                  UTILITY CODE
           ************************** */

        /**
         * Display the countdown timer on the Host screen
         *
         * @param $el The container element for the countdown timer
         * @param startTime
         * @param callback The function to call when the timer ends.
         */
        countDown : function( $el, startTime, callback) {

            // Display the starting time on the screen.
            $el.text(startTime);

            // Start a 1 second timer
            var timer = setInterval(countItDown,1000);

            // Decrement the displayed timer value on each 'tick'
            function countItDown(){
                startTime -= 1
                $el.text(startTime);

                if( startTime <= 0 ){
                    // Stop the timer and do the callback.
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        }

    };

    IO.init();
    App.init();
    App.unload();

}($));
