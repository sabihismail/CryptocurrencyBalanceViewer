# Cryptocurrency Balance Viewer with Bittrex.com Support
This application stores data about the worth of all stored coins on 
your Bittrex.com account. Included is a data visualizer which allows
you to view your wallet's ups-and-downs in a convenient stacked area
line graph.

This application is created in Node.JS and data is stored in a MongoDB
database.

## Getting Started
Either [install MongoDB](https://www.mongodb.com/download-center#community)
or acquire a server through some other means (such as an online server).

Also, [install Node.JS](https://nodejs.org/en/download/).

Create an API Key from Bittrex.com from 
[here](https://bittrex.com/Manage#sectionApi) and note down both the 
API Key and the API Secret. **Ensure that 'READ INFO' is enabled for the API
key.**

## Configuration
1. Download the whole project.
2. Go to the '/scripts/' folder.
3. For 'bittrex-config.js', paste your API Key and API Secret in the quotes.
Also make sure the standard government currency is correct.
4. For 'db-config.js', edit the data for the MongoDB server to match your
server information.
5. You're all set! Double click 'run.bat' to start the MongoDB server and
then the Node.JS server.

## Built With
* [Node.JS](https://nodejs.org/) - Open source server framework
* [ExpressJS](https://expressjs.com/) - Web framework for Node.JS
* [request](https://github.com/request/request) - HTTP request client
* [d3](https://d3js.org/) - Data manipulation JavaScript library
* [nvd3](http://nvd3.org/) - Advanced chart creation JavaScript library
* [node-schedule](https://github.com/node-schedule/node-schedule) Node.JS
scheduler
* [pug](https://pugjs.org/) - HTML template engine for Node.JS
