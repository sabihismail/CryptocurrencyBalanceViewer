const schedule = require('node-schedule');
const backup = require('mongodb-backup');
const crypto = require('crypto');
const request = require('request');
const dbConfig = require('./db-config');
const bittrexConfig = require('./bittrex-config');

const urlBalance = 'https://bittrex.com/api/v1.1/account/getbalances';
const urlTicker = 'https://bittrex.com/api/v1.1/public/getticker?market=btc-';
const urlPrice = 'https://api.coinmarketcap.com/v1/ticker/bitcoin/?convert=';

const collectionName = 'bittrex';
const collection = dbConfig.data(collectionName)['collections'][0];

/**
 * Primarily establishes connection to the MongoDB database and the bittrex collection.
 *
 * If the collection does not exist, it will create it.
 */
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect(dbConfig.url(collectionName), function (err, db) {
  if (err) {
    return console.log(err);
  }

  db.createCollection(collection, function (err, res) {
    if (err) {
      throw console.log(err);
    }

    console.log("Created " + collection);
  });

  console.log("Connected to server.");
  start(db);
});

/**
 * Initiates schedule timer that should run the contained function once every minute.
 *
 * @param db The MongoDB database instance.
 */
const start = function (db) {
  schedule.scheduleJob('0 * * * * *', function () {
    getBalanceInformation(db);
  });

  schedule.scheduleJob('0 0 * * *', function () {
    backupDatabase(db);
  });
};

/**
 * Retrieves the current balance information from bittrex through the API and supplies that data to
 * {@link getCurrentCurrencyInformation}.
 *
 * The API requires a nonce (number used only once) which, for these purposes, is the current Unix time. The API also
 * requires an API key contained in {@link #bittrexConfig}. A signature in the header is also required which is created
 * using the method {@link #hmacSHA512Encrypt}.
 *
 * @param db The MongoDB database instance.
 */
const getBalanceInformation = function (db) {
  const nonce = new Date().getTime();
  const url = urlBalance + '?apikey=' + bittrexConfig.api_key + '&nonce=' + nonce;
  const signature = hmacSHA512Encrypt(url, bittrexConfig.api_secret);
  request({ url: url, method: "GET", headers: { apisign: signature } }, function (err, res, body) {
    if (err) {
      return console.log(err);
    }

    try {
      const json = JSON.parse(body);

      if (json['success'] === false) {
        return console.log(json['message']);
      }

      getCurrentCurrencyInformation(db, json['result']);
    } catch (e) {
      console.log("getBalanceInformation(): " + url + " " + body);
    }
  });
};

/**
 * Gets current currency worth for each cryptocurrency contained in 'jsonBalance'. This includes the price of the
 * coin relative to bitcoin, and the price in fiat (government regulated currency such as USD or CAD).
 *
 * This data is then passed to {@link createDataEntry}.
 *
 * @param db The MongoDB database instance.
 * @param jsonBalance Current wallet balances returned from {@link getBalanceInformation}.
 */
const getCurrentCurrencyInformation = function (db, jsonBalance) {
  for (let i = 0; i < jsonBalance.length; i++) {
    const currency = jsonBalance[i]['Currency'];
    const balance = parseFloat(jsonBalance[i]['Balance']);

    const url = urlTicker + currency;

    request({ url: url, method: "GET" }, function (err, res, body) {
      if (err) {
        return console.log(err);
      }

      const jsonTicker = JSON.parse(body);
      if (jsonTicker['success'] === false) {
        if (jsonTicker['message'] === 'INVALID_MARKET' && currency.toLowerCase() === 'btc') {
          jsonTicker['result'] = {
            Ask: 1
          }
        } else {
          return console.log(jsonTicker['message']);
        }
      }

      try {
        const price_btc = parseFloat(jsonTicker['result']['Ask']);
        const time = Math.floor(new Date().getTime() / (1000 * 60));

        createDataEntry(db, currency, time, balance, price_btc);
      } catch (e) {
        console.log("getCurrentCurrencyInformation() " + url + " " + jsonTicker + " " + jsonBalance);
      }
    });
  }
};

/**
 * Data for each entry is generated in this method.
 *
 * The data is then passed into {@link saveData}.
 *
 * @param db The MongoDB database instance.
 * @param currency Name of currency coin.
 * @param time Current time in seconds since Unix epoch.
 * @param balance Current wallet balance in the currency.
 * @param price_btc Price of the currency in bitcoin.
 */
const createDataEntry = function (db, currency, time, balance, price_btc) {
  const url = urlPrice + bittrexConfig.fiat_currency;

  request({ url: url, method: "GET" }, function (err, res, body) {
    if (err) {
      return console.log(err);
    }

    const json = JSON.parse(body)[0];
    const price = parseFloat(json['price_' + bittrexConfig.fiat_currency.toLowerCase()]);

    const price_fiat = parseFloat((price_btc * price * balance).toFixed(2));

    saveData(db, currency, time, balance, price_btc, price_fiat);
  });
};

/**
 * Saves data into the MongoDB database instance 'db'. If the currency document does not exist, a new document for that
 * currency is generated.
 *
 * The schema looks like:
 * {
 *   '_id': currency_name,
 *   'values': [
 *     {
 *       time: current_time_in_seconds_since_Unix_epoch,
 *       balance: current_balance_of_coin,
 *       price_btc: coin_worth_in_bitcoin's_current_price,
 *       price_fiat: coin_worth_in_government_currency
 *     }
 *   ]
 * }
 *
 * @param db The MongoDB database instance.
 * @param currency Name of currency coin.
 * @param time Current time in seconds since Unix epoch.
 * @param balance Current wallet balance in the currency.
 * @param price_btc Price of the currency in bitcoin.
 * @param price_fiat Price of the currency in government regulated currency such as USD/CAD.
 */
const saveData = function (db, currency, time, balance, price_btc, price_fiat) {
  db.collection(collection).findOne({ '_id': currency }, function (err, doc) {
    const values = {
      'values': {
        time: time,
        balance: balance,
        price_fiat: price_fiat
      }
    };

    if (price_btc !== 1) {
      values['values']['price_btc'] = price_btc;
    }

    if (doc === null) {
      db.collection(collection).insertOne({ '_id' : currency, 'values': [] }).then(function () {
        db.collection(collection).updateOne({ '_id': currency }, { '$push': values });
      });
    } else {
      db.collection(collection).updateOne({ '_id': currency }, { '$push': values });
    }
  });
};

/**
 * Creates HMAC SHA512 hash.
 *
 * @param str The string that is to be hashed.
 * @param key The key which will be used to hash 'str'.
 * @returns {string} Returns the generated hash.
 */
const hmacSHA512Encrypt = function (str, key) {
  const hmac = crypto.createHmac("SHA512", key);
  return hmac.update(str).digest("HEX");
};

/**
 * Backups up MongoDB database everyday at 12am.
 *
 * @param db MongoDB database object that will be backed up.
 */
const backupDatabase = function (db) {
  backup({
    uri: db.options.url,
    dir: 'db_backups/',
    collections: [ collectionName ]
  })
};
