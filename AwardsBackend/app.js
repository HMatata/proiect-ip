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

app.listen(6002);
console.log('Listening on port 6002');

app.get('/', function(req, res){
    res.send('Hello World');
});

function compute_hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64');
}

/*
    Wrapper for collection.find()
 */
function scrape_collection( coll, query, opt, callback ){

    console.log("Mongo Query: " + coll + ": " + JSON.stringify(query) + " " + JSON.stringify(query) );

    db.collection( coll ).find( query, opt, function(err, cursor){
        if( err ) throw err;

        cursor.toArray( function(err, items){
            if( err ) throw err;

            console.log( items );
            callback( items );
        });

    });
}

var db = null;
var security_key = null;

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

        get_security_key()
    });
}

function get_security_key()
{
    if( db == null ){
        throw "invalid db";
    }

    db.collection('shadow').findOne( {}, function( err, doc ){

        if( doc == null ){
            console.log("No sec. key in the db");
        }

        security_key = doc.key;
        console.log("Got key " + security_key + " !" );

        setup_api();
    });
}

function valid_hash( ext_hash, data )
{
    var hash_internal = compute_hash( security_key + data );
    var hash_external = compute_hash( ext_hash     + data );

    console.log("Hashbang: " + hash_internal + " " + hash_external + "\n" );

    if( hash_internal != hash_external ){
        throw "Inconsistent hash";     // enabled for debugging
        //return false;
    }

    return true;
}

function setup_api()
{
    /*
        Example query : /get_achievements/1/1/unbreakable_secure_key
     */
    app.get('/get_achievements/:user_id/:app_id/:ext_hash', function(req, res){

        var app_id   = req.params.app_id;
        var user_id  = req.params.user_id;
        var ext_hash = req.params.ext_hash;
        var data = app_id + user_id;

        if( valid_hash( ext_hash, data ) ){

            console.log("Here");
            scrape_collection( 'user_game_awards',
                             { user_id : Number(user_id), app_id : Number(app_id) },
                             { username : Number(1), awards : Number(1) },

                             function( results ){
                                 res.send( results );
                             });
        }
    });


}

trigger();