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

function addData(currency) {
  function createChart() {
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
          align: 'right',
          x: -3
        },

        stackLabels: {
          enabled: true,

          style: {
            color: 'white'
          },

          formatter: function () {
            const ticks = this.axis.chart.xAxis[0].tickPositions;

            if (this.x === ticks[ticks.length - 1]) {
              return '$' + Highcharts.numberFormat(this.total, 2);
            }
          }
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

  const seriesOptions = [];
  let seriesCounter = 0;
  $.each(currency, function (i, name) {
    $.getJSON(window.location.href + 'api/currency?coin=' + name, function (data) {
      data = parseData(data);

      seriesOptions[i] = {
        name: name,
        data: data
      };

      seriesCounter += 1;

      if (seriesCounter === currency.length) {
        createChart();
      }
    });
  });
}
