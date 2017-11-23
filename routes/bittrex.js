const express = require('express');
const router = express.Router();

const dbConfig = require('../scripts/db-config');

const collectionName = 'bittrex';
const collection = dbConfig.data(collectionName)['collections'][0];

/**
 * Returns the main page for the chart data.
 */
router.get('/', function (req, res) {
  res.render('bittrex');
});

/**
 * Returns data based on the parameter 'coin'.
 */
router.get('/api/currency', function(req, res) {
  const coin = req.query.coin;

  if (coin === undefined) {
    const error = {
      success: false,
      message: 'Missing coin parameter'
    };

    return res.status(400).send(error);
  }

  const MongoClient = require('mongodb').MongoClient;
  MongoClient.connect(dbConfig.url(collectionName), function (err, db) {
    if (err) {
      return console.log(err);
    }

    getSpecificCoin(db, coin, function (data) {
      res.json(data);

      db.close();
    })
  });
});

/**
 * Returns all coins but not their information.
 */
router.get('/api/currency/all', function(req, res) {
  const MongoClient = require('mongodb').MongoClient;
  MongoClient.connect(dbConfig.url(collectionName), function (err, db) {
    if (err) {
      return console.log(err);
    }

    getAllCoins(db, function (data) {
      res.json(data);

      db.close();
    })
  });
});

/**
 * Returns all coins with data stored in database.
 *
 * @param db MongoDB database instance.
 * @param callback Function to handle the data returned.
 */
const getAllCoins = function (db, callback) {
  db.collection(collection).distinct("_id").then(callback);
};

/**
 * Returns all data about a certain coin.
 *
 * @param db MongoDB database instance.
 * @param coin The coin that is being requested.
 * @param callback Function to handle the data returned.
 */
const getSpecificCoin = function (db, coin, callback) {
  db.collection(collection).findOne({ "_id" : coin.toUpperCase() }).then(callback);
};

module.exports = router;
