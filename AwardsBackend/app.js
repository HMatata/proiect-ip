/**
 * User: johnthebrave
 * Date: 5/19/13
 * Time: 5:51 PM
 */

var express = require('express'),
    crypto = require('crypto'),
    app = express(),
    server = require('http').createServer(app),
    mongo = require('mongodb').MongoClient,
    fs = require('fs');

app.listen(process.argv[2]);
console.log('Listening on port 6002');

app.get('/', function(req, res){
    res.send('Hello World');
});

function compute_hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64').replace("/",'|');
}

function set_errno( err, dbg ){

    if( err == null ){
        return { ok : 0 };
    }

    db.collection( "error_log").insert( { query : dbg, err : err }, function(err){
        if( err ) throw err;
    });

    return { ok : err };
}
/*
    Wrapper for collection.find()
 */
function scrape_collection( coll, query, opt, callback ){

    var dbg = "Query: " + coll + ": " + JSON.stringify(query) + " " + JSON.stringify(opt);
    console.log( dbg );

    db.collection( coll ).find( query, opt, function(err, cursor){
        if( err ) throw err;

        cursor.toArray( function(err, items){
            if( err ) throw err;

            console.log( items );
            callback( items );
        });

    });
}

function insert_document( coll, element, opt, callback ){

    var dbg = "Insert: " + coll + ": " + JSON.stringify(element);

    db.collection( coll ).insert( element, opt, function(err){
        var ret = set_errno(err, dbg);
        callback(ret);
    })
}

function save_document( coll, element, opt, callback ){

    var dbg = "Save: " + coll + ": " + JSON.stringify(element) + " " + JSON.stringify(opt);

    db.collection( coll ).save( element, opt, function(err){
        var ret = set_errno(err, dbg);
        callback(ret);
    })
}

function update_document( coll, element, update, opt, callback ){

    var dbg =  "Update: " + coll + ": " + JSON.stringify(element) + " " + JSON.stringify(opt);

    db.collection( coll ).update( element, update, opt, function(err){
        var ret = set_errno(err, dbg);
        callback(ret);
    })
}


var db = null;

function trigger(){
    get_db_object();
}

function get_db_object(){

    mongo.connect("mongodb://localhost:27017/content", function(err, database) {

        if(err) {
            throw err;
        }

        console.log("Connected to mongo.");

        db = database;
        get_security_keys()
    });
}

var app_key = {};

function get_security_keys()
{
    if( db == null ){
        throw "invalid db";
    }

    scrape_collection( 'shadow', {}, {}, function( elem ){

          for( var i = elem.length - 1; i >= 0; --i ){
              app_key[ elem[i].app_id ] = elem[i].keys;
          }

          setup_api();
    });
}

function valid_hash( digest, app_id, data )
{
    var hash_internal = compute_hash( app_key[app_id] + data );
    console.log("Hashbang: " + hash_internal + " " + digest + "\n" );
    return hash_internal == digest;
}

function setup_api()
{
    app.get('/get_achievements/:user_id/:app_id/:digest', function(req, res){

        var digest   = req.params.digest;
        var app_id   = req.params.app_id;
        var user_id  = req.params.user_id;

        var data = app_id + user_id;

        if( valid_hash( digest, app_id, data ) ){

            console.log("Here");
            scrape_collection( 'user_game_awards',
                             { user_id : Number(user_id), app_id : Number(app_id) },
                             { username : Number(1), awards : Number(1) },

                             function( results ){
                                 res.send( results );
                             });
        }
        else
        {
            res.send( { ok : "Invalid hash" } );
        }
    });

    app.get('/add_achievements/:achievement/:user_id/:app_id/:digest', function(req, res){

        var digest      = req.params.digest;
        var app_id      = req.params.app_id;
        var user_id     = req.params.user_id;
        var achievement = req.params.achievement;

        var data = app_id + user_id + achievement;

        if( valid_hash( digest, app_id, data ) ){

            console.log("Here");
            update_document( 'user_game_awards',
                           { user_id : Number(user_id), app_id : Number(app_id) },
                           { $addToSet: { awards : achievement } },
                           { w : 1 },
                           function( results ){
                             res.send( results );
                           });
        }
        else
        {
            res.send( { ok : "Invalid Hash" } )
        }

    });

    /*
        Example query /get_scores/1/1/unbreakable_secure_key
     */

    app.get('/get_scores/:user_id/:app_id/:digest', function(req, res){

        var digest    = req.params.digest;
        var app_id    = req.params.app_id;
        var user_id   = req.params.user_id;

        var data = app_id + user_id;

        if( valid_hash( digest, app_id, data ) ){

            scrape_collection( 'user_game_score',
                { user_id : Number(user_id), app_id : Number(app_id) },
                { score : Number(1), context : Number(1) },

                function( results ){
                    res.send( results );
                });
        }
        else
        {
            res.send( { ok : "Invalid Hash" } );
        }

    });

    app.get('/add_score/:user_id/:app_id/:score/:context/:digest', function( req, res ){

        var digest    = req.params.digest;
        var app_id    = req.params.app_id;
        var user_id   = req.params.user_id;

        var score   = req.params.score;
        var context = req.params.context;

        var data = app_id + user_id + score + context;

        if( valid_hash( digest, app_id, data ) ){

            update_document( 'user_game_score',
                { user_id : Number(user_id), app_id : Number(app_id) },
                { $addToSet: { context : context }, $inc : { score: Number(score) } },
                { upsert : true, w : 1 },
                function( results ){
                    res.send( results );
                });

        }
        else
        {
            res.send( { ok : "Invalid Hash" } );
        }

    });

    /*
        get_user_info/1/1/Q9emLM6kjQE+IqGmkOdpCPz1abw=
     */

    app.get('/get_user_info/:user_id/:app_id/:digest', function( req, res ){

        var digest    = req.params.digest;
        var app_id    = req.params.app_id;
        var user_id   = req.params.user_id;

        var data = app_id + user_id;

        var ans = {};

        if( valid_hash( digest, app_id, data ) ){

            var user_app = { user_id : Number(user_id), app_id : Number(app_id) };

            scrape_collection( 'users',
                { _id : Number(user_id) },
                { prefs: 1 },
                function( results ){

                     ans.prefs = results[0].prefs;

                     scrape_collection( 'user_game_data',
                        user_app,
                        { data : 1 },
                         function( results ){

                            ans.game_data = results[0].data;
                            scrape_collection( 'user_game_score',
                              user_app,
                              { score : 1, context : 1 },
                              function( results ){
                                  ans.score   = results[0].score;
                                  ans.context = results[0].context;
                                  res.send( ans );
                            });
                     });
                }
            );
        }
        else
        {
            res.send( { ok : "Invalid Hash" } );
        }

    });

    /*
        Here I just assume feedback is a magic blob with all the data we might want
        ( like user_id/nickname/rating )
     */

    app.get('/add_feedback/:feedback', function(req, res) {

        var feedback = req.params.feedback;
        insert_document( 'feedback', { content: feedback, date : new Date() } , {}, function( result ){
            res.send(result);
        });
    });

    /*
       Retrieves a json array with feedback items
     */

    app.get('/get_feedback', function(req,res){

       scrape_collection('feedback', {}, {}, function(results){
          res.send(results);
       });

    });

}

trigger();
