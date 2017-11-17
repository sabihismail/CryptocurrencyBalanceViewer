/**
 * Details about the MongoDB server where data will be stored.
 */
const config = {
  bittrex: {
    host: 'localhost',
    port: '27017',
    db: 'bittrex',
    collections: [
      'data'
    ]
  }
};

module.exports = {
  /**
   * Returns the URL composition of a MongoDB server based on the information passed in from {@link #config}.
   *
   * @param server The server information that will be passed in.
   * @returns {string}
   */
  url: function (server) {
    const db = config[server];

    return "mongodb://" + db.host + ":" + db.port + "/" + db.db;
  },

  /**
   * Returns configuration details about a server retrieved from {@link #config}.
   *
   * @param server The server name in {@link config}.
   * @returns {Array} Configuration details about the server.
   */
  data: function (server) {
    return config[server];
  }
};
