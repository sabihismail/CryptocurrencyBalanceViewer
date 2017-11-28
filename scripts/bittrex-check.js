const schedule = require('node-schedule');
const backup = require('mongodb-backup');
const crypto = require('crypto');
const request = require('request');
const dbConfig = require('./db-config');
const bittrexConfig = require('./bittrex-config');

const URL_BALANCE = 'https://bittrex.com/api/v1.1/account/getbalances';
const URL_TICKER = 'https://bittrex.com/api/v1.1/public/getticker?market=';
const URL_PRICE = 'https://api.coinmarketcap.com/v1/ticker/bitcoin/?convert=';

const MARKET_BASE = 'BTC';

const COLLECTION_NAME = 'bittrex';
const COLLECTION = dbConfig.data(COLLECTION_NAME)['collections'][0];

function bittrex_check(app) {
  const server = require('http').createServer(app);
  const io = require('socket.io').listen(server);
  server.listen(3000);

  io.on('connection', function (socket) {
    console.log('CONNECTED TO SOCKET: ' + socket.handshake.address);
    
    socket.on('disconnect', function () {
      console.log('DISCONNECTED: ' + socket.handshake.address);
    })
  });

  /**
   * Primarily establishes connection to the MongoDB database and the bittrex collection.
   *
   * If the collection does not exist, it will create it.
   */
  const MongoClient = require('mongodb').MongoClient;
  MongoClient.connect(dbConfig.url(COLLECTION_NAME), function (err, db) {
    if (err) {
      return console.error(err);
    }

    db.createCollection(COLLECTION, function (err, res) {
      if (err) {
        throw console.error(err);
      }

      console.log('Created ' + COLLECTION);
    });

    console.log('Connected to server');
    start(db);
  });

  /**
   * Initiates schedule timer that should run the contained function once every minute.
   *
   * @param db The MongoDB database instance.
   */
  function start(db) {
    schedule.scheduleJob('0 * * * * *', function () {
      getBalanceInformation(db);
    });

    schedule.scheduleJob('0 0 * * *', function () {
      backupDatabase(db);
    });
  }

  /**
   * Retrieves the current balance information from bittrex through the API and supplies that data to
   * {@link #getCurrentCurrencyInformation}.
   *
   * The API requires a nonce (number used only once) which, for these purposes, is the current Unix time. The API also
   * requires an API key contained in {@link #bittrexConfig}. A signature in the header is also required which is created
   * using the method {@link #hmacSHA512Encrypt}.
   *
   * @param db The MongoDB database instance.
   */
  function getBalanceInformation(db) {
    const nonce = new Date().getTime();
    const url = URL_BALANCE + '?apikey=' + bittrexConfig.api_key + '&nonce=' + nonce;
    const signature = hmacSHA512Encrypt(url, bittrexConfig.api_secret);
    request({url: url, method: 'GET', headers: {apisign: signature}}, function (err, res, body) {
      if (err) {
        return console.error(err);
      }

      try {
        const json = JSON.parse(body);

        if (json['success'] === false) {
          return console.error(url + '\n\n' + json);
        }

        getCurrentCurrencyInformation(db, json['result']);
      } catch (e) {
        console.error('getBalanceInformation(): ' + '\n\n' + url + '\n\n' + body, e.stack);
      }
    });
  }

  /**
   * Gets values from 'jsonBalance' and extracts currency and balance for every coin in 'jsonBalance'.
   *
   * This data is then passed to {@link #requestCurrencyInformation} which actually retrieves the data.
   *
   * @param db The MongoDB database instance.
   * @param jsonBalance Current wallet balances returned from {@link #getBalanceInformation}.
   */
  function getCurrentCurrencyInformation(db, jsonBalance) {
    for (let i = 0; i < jsonBalance.length; i++) {
      const currency = jsonBalance[i]['Currency'];
      const balance = parseFloat(jsonBalance[i]['Balance']);

      requestCurrencyInformation(db, currency, balance, true);
    }
  }

  /**
   * Gets current currency worth for each cryptocurrency contained in 'jsonBalance'. This includes the price of the
   * coin relative to {@link #MARKET_BASE}, and the price in fiat (government regulated currency such as USD or CAD).
   *
   * If 'INVALID_MARKET' message is received and the value is {@link #MARKET_BASE}, the value should be 1 as that is the
   * worth to itself. If it is not {@link #MARKET_BASE}, it can be assumed that the market is different.
   *
   * If the data retrieved is in a different market (like Tether coin (USDT)) then the ask amount will be how many of
   * the currency relative to {@link #MARKET_BASE}. Because of this, the value must be inverted to get the amount of
   * {@link #MARKET_BASE} is worth to 1 of the current currency.
   *
   * This data is then passed to {@link #createDataEntry}.
   *
   * @param db The MongoDB database instance.
   * @param currency Name of currency.
   * @param balance Balance of currency in wallet.
   * @param marketFirst TRUE if the {@link #MARKET_BASE} precedes the current currency name in the URL.
   */
  function requestCurrencyInformation(db, currency, balance, marketFirst) {
    let url;
    if (marketFirst) {
      url = URL_TICKER + MARKET_BASE + '-' + currency;
    } else {
      url = URL_TICKER + currency + '-' + MARKET_BASE;
    }

    request({url: url, method: 'GET'}, function (err, res, body) {
      if (err) {
        return console.error(err);
      }

      try {
        const jsonTicker = JSON.parse(body);

        if (jsonTicker['success'] === false) {
          if (jsonTicker['message'] === 'INVALID_MARKET' && currency.toUpperCase() === MARKET_BASE) {
            jsonTicker['result'] = {
              Ask: 1
            }
          } else if (jsonTicker['message'] === 'INVALID_MARKET' && currency.toUpperCase() !== MARKET_BASE) {
            return requestCurrencyInformation(db, currency, balance, false);
          } else {
            console.error(url + '\n\n' + currency + '\n\n' + balance);
          }
        }

        let priceMarketBase = parseFloat(jsonTicker['result']['Ask']);
        if (!marketFirst) {
          priceMarketBase = 1 / priceMarketBase;
        }

        const time = Math.floor(Date.now() / 1000 / 60);

        createDataEntry(db, currency, time, balance, priceMarketBase);
      } catch (e) {
        console.error('getCurrentCurrencyInformation() ' + url + '\n\n' + body + '\n\n' + currency + '\n\n');
      }
    });
  }

  /**
   * Data for each entry is generated in this method.
   *
   * The data is then passed into {@link #saveData}.
   *
   * @param db The MongoDB database instance.
   * @param currency Name of currency coin.
   * @param time Current time in seconds since Unix epoch.
   * @param balance Current wallet balance in the currency.
   * @param priceMarketBase Price of the currency in {@link #MARKET_BASE} .
   */
  function createDataEntry(db, currency, time, balance, priceMarketBase) {
    const url = URL_PRICE + bittrexConfig.fiat_currency;

    request({url: url, method: 'GET'}, function (err, res, body) {
      if (err) {
        return console.error(err);
      }

      try {
        const json = JSON.parse(body);

        const price = parseFloat(json[0]['price_' + bittrexConfig.fiat_currency.toLowerCase()]);
        const priceFiat = parseFloat((priceMarketBase * price * balance).toFixed(2));

        saveData(db, currency, time, balance, priceMarketBase, priceFiat);
      } catch (e) {
        console.error(body);
      }
    });
  }

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
 *       price_btc: coin_worth_in_ {@link #marketBase} 's_current_price,
 *       price_fiat: coin_worth_in_government_currency
 *     }
 *   ]
 * }
   *
   * @param db The MongoDB database instance.
   * @param currency Name of currency coin.
   * @param time Current time in seconds since Unix epoch.
   * @param balance Current wallet balance in the currency.
   * @param priceMarketBase Price of the currency in {@link #MARKET_BASE}.
   * @param priceFiat Price of the currency in government regulated currency such as USD/CAD.
   */
  function saveData(db, currency, time, balance, priceMarketBase, priceFiat) {
    db.collection(COLLECTION).findOne({'_id': currency}, function (err, doc) {
      const values = {
        time: time,
        balance: balance,
        price_fiat: priceFiat
      };

      if (priceMarketBase !== 1) {
        values['price_btc'] = priceMarketBase;
      }

      const valueObject = {
        'values': values
      };

      const socketData = {
        _id: currency,
        'values': [values]
      };

      if (doc === null) {
        db.collection(COLLECTION).insertOne({'_id': currency, 'values': []}).then(function () {
          db.collection(COLLECTION).updateOne({'_id': currency}, {'$push': valueObject});
        });
      } else {
        db.collection(COLLECTION).updateOne({'_id': currency}, {'$push': valueObject});
      }

      io.emit('data', socketData);
    });
  }

  /**
   * Creates HMAC SHA512 hash.
   *
   * @param str The string that is to be hashed.
   * @param key The key which will be used to hash 'str'.
   * @returns {string} Returns the generated hash.
   */
  function hmacSHA512Encrypt(str, key) {
    const hmac = crypto.createHmac('SHA512', key);
    return hmac.update(str).digest('HEX');
  }

  /**
   * Backups up MongoDB database everyday at 12am.
   *
   * @param db MongoDB database object that will be backed up.
   */
  function backupDatabase(db) {
    backup({
      uri: db.options.url,
      dir: 'db_backups/',
      collections: [COLLECTION_NAME]
    })
  }
}

module.exports = bittrex_check;
