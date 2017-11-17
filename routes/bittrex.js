const express = require('express');
const router = express.Router();

const dbConfig = require('../scripts/db-config');

const document = 'bittrex';
const collection = dbConfig.data(document)['collections'][0];

/**
 * Returns the main page for the chart data.
 */
router.get('/', function (req, res) {
  res.render('bittrex', { title: 'Bittrex Data Chart' });
});

/**
 * Returns data based on the parameter 'span'.
 *
 * If 'span' is empty, the default amount of information returned is the past 24 hours.
 */
router.get('/data', function(req, res) {
  const span = req.query.span;

  const MongoClient = require('mongodb').MongoClient;
  MongoClient.connect(dbConfig.url(document), function (err, db) {
    if (err) {
      return console.log(err);
    }

    console.log("Connected to server.");
    getData(db, span, function (data) {
      res.json(data);

      db.close();
    })
  });
});

/**
 * Returns the time in seconds in Unix time which indicates what time the data should be retrieved from based on the
 * inputted 'span' parameter.
 *
 * @param span The amount of information the user requested.
 * @returns {number} The amount of time in seconds since Unix time.
 */
const retrieveOldTime = function (span) {
  let oldTime = Math.floor(new Date().getTime() / 1000);

  if (span === undefined) {
    span = 'day';
  } else {
    span = span.toLowerCase();
  }

  if (span === 'week') {
    oldTime -= 60 * 60 * 24 * 7;
  } else if (span === 'month') {
    oldTime -= 60 * 60 * 24 * 30;
  } else if (span === 'year') {
    oldTime -= 60 * 60 * 24 * 365;
  } else {
    oldTime -= 60 * 60 * 24;
  }

  return oldTime;
};

/**
 * Retrieves data from the bittrex database and returns that data in JSON format.
 *
 * @param db MongoDB database instance.
 * @param span The amount of data to return passed in as a parameter from the user.
 * @param callback A function that is to handle the data retrieved.
 */
const getData = function (db, span, callback) {
  const oldTime = retrieveOldTime(span);

  db.collection(collection).aggregate({
    $project: {
      values: {
        $filter: {
          input: "$values",
          as: "value",
          cond: { $gte: ["$$value.time", oldTime] }
        }
      }
    }
  }, function (err, res) {
    return callback(res);
  });
};

module.exports = router;
