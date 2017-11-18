/**
 * Retrieves all coins that exist.
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
    const start = new Date();

    Highcharts.stockChart('line-chart', {
      chart: {
        events: {
          load: function () {
            const allData = new Map();

            const xData = this.series[0].processedXData;
            for (let i = 0; i < this.series.length; i++) {
              if (this.series[i].userOptions.name.includes('Navigator')) {
                continue;
              }

              for (let j = 0; j < xData.length; j++) {
                const y = this.series[i].processedYData[j];
                const x = xData[j];

                allData.has(x) ? allData.set(x, allData.get(x) + y) : allData.set(x, y);
              }
            }

            this.addSeries({
              name: 'TOTAL',
              data: Array.from(allData),
              yAxis: 'all'
            }, false);

            this.redraw();
          }
        },
        zoomType: 'x'
      },

      rangeSelector: {
        buttons: [{
          count: 30,
          type: 'minute',
          text: '30M'
        }, {
          count: 1,
          type: 'hour',
          text: '1H'
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
          type: 'all',
          text: 'All'
        }],
        inputEnabled: true,
        selected: 5
      },

      yAxis: [{
        labels: {
          align: 'right',
          x: -3
        },
        height: '55%',
        lineWidth: 2
      }, {
        id: 'all',
        labels: {
          align: 'right',
          x: -3
        },
        top: '65%',
        height: '35%',
        offset: 0,
        lineWidth: 2
      }],

      title: {
        text: 'Currency tracker for: ' + currency.join(', ')
      },

      tooltip: {
        formatter: function () {
          let s = '<b>' + moment(new Date(this.x)).format('MMMM Do YYYY, h:mm:ss a') + '</b>';

          $.each(this.points, function () {
            if (this.y !== 0) {
              s += '<br/>';

              if (this.series.name === 'TOTAL') {
                s += '<b>' + 'Total: ' + Highcharts.numberFormat(this.y, 2) + '</b>';
              } else {
                s += this.series.name + ': ' + Highcharts.numberFormat(this.y, 2);
              }
            }
          });

          return s;
        }
      },

      series: seriesOptions
    });
  }

  function parseData(data) {
    const newData = [];
    const val = data['values'];

    for (let i = 0; i < val.length; i++) {
      const time = val[i]['time'] * 1000;
      const price_fiat = val[i]['price_fiat'];

      if (i === val.length - 1) {
        newData.push([time, { y: price_fiat, dataLabels: { enabled: true, format: '{y}' } }]);
      } else {
        newData.push([time, price_fiat]);
      }
    }

    return newData;
  }

  const seriesOptions = [];
  let seriesCounter = 0;
  $.each(currency, function (i, name) {
    $.getJSON(window.location.href + '/api/currency?coin=' + name, function (data) {
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
