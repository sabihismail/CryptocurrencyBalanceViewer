/**
 * Retrieves all coins that exist in the database.
 *
 * Uses the constant {@link span} to decide how much data to return. By default, this is 'day' or 24 hours worth of
 * information.
 */
$.ajax({
  url: window.location.href + 'api/currency/all',
  cache: false,
  dataType: 'json',
  success: function (json) {
    addData(json);
  }
});

/**
 * Iterates through each coin, parses the data to exclude unnecessary information, and then creates a series with that
 * data.
 *
 * After iterating through every list, the chart is created.
 *
 * @param currency The JSON Array of all currencies with available data in the database.
 */
function addData(currency) {
  let seriesCounter = 0;
  const seriesOptions = [];

  $.each(currency, function (i, name) {
    $.getJSON(window.location.href + 'api/currency?coin=' + name, function (data) {
      data = parseData(data);

      seriesOptions[i] = {
        name: name,
        data: data
      };

      seriesCounter += 1;

      if (seriesCounter === currency.length) {
        createChart(seriesOptions);
      }
    });
  });
}

/**
 * Parses data by only retrieving adding time data and the fiat price data into an array.
 *
 * @param data Data that is to be parsed.
 * @returns {Array} The Arraya of [x,y] data for the series.
 */
function parseData(data) {
  const newData = [];
  const val = data['values'];

  for (let i = 0; i < val.length; i++) {
    const time = val[i]['time'] * (1000 * 60);
    const price_fiat = val[i]['price_fiat'];

    newData.push([time, price_fiat]);
  }

  return newData;
}

/**
 * Creates the chart using Highstocks/Highcharts API.
 *
 * @param seriesOptions All the series data that is to be added to the chart.
 */
function createChart(seriesOptions) {
  Highcharts.stockChart('line-chart', {
    chart: {
      type: 'area',
      zoomType: 'x'
    },

    rangeSelector: {
      inputEnabled: true,
      selected: 5,

      buttons: [{
        count: 1,
        type: 'hour',
        text: '1H'
      }, {
        count: 3,
        type: 'hour',
        text: '3H'
      }, {
        count: 6,
        type: 'hour',
        text: '6H'
      }, {
        count: 12,
        type: 'hour',
        text: '12H'
      }, {
        count: 1,
        type: 'day',
        text: '1D'
      }, {
        count: 1,
        type: 'week',
        text: '1W'
      }, {
        count: 1,
        type: 'month',
        text: '1M'
      }, {
        count: 1,
        type: 'month',
        text: '1M'
      }, {
        count: 3,
        type: 'month',
        text: '3M'
      }, {
        count: 6,
        type: 'month',
        text: '6M'
      }, {
        count: 1,
        type: 'year',
        text: '1Y'
      }, {
        type: 'all',
        text: 'All'
      }]
    },

    yAxis: [{
      height: '100%',
      lineWidth: 2,

      labels: {
        align: 'right'
      }
    }, {
      linkedTo: 0,

      labels: {
        x: 5
      },

      tickPositioner: function () {
        let total = 0;

        for (let i = 0; i < this.chart.yAxis[0].series.length; i++) {
          const data = this.chart.yAxis[0].series[i].processedYData;

          total += data[data.length - 1];
        }

        return [Math.round(total)];
      }
    }],

    plotOptions: {
      area: {
        stacking: 'normal',
      }
    },

    legend: {
      enabled: true
    },

    tooltip: {
      valueDecimals: 2,
      valuePrefix: '$',
      shared: false
    },

    series: seriesOptions
  });
}
