const span = 'day';

/**
 * Retrieves and parses latest data required for chart creation.
 *
 * Uses the constant {@link span} to decide how much data to return. By default, this is 'day' or 24 hours worth of
 * information.
 */
$.ajax({
  url: window.location.href + 'data?span=' + span,
  cache: false,
  dataType: 'json',
  success: function (json) {
    addData(json);
  }
});

/**
 * Creates JSON object with only necessary data for chart creation.
 *
 * @param data JSON data returned from data request.
 * @returns {Array} Newly constructed array with all necessary data.
 */
const modifyData = function (data) {
  let obj = [];

  for (let i = 0; i < data.length; i++) {
    const curValues = data[i]['values'];

    const key = data[i]['_id'];
    const values = [];

    for (let j = 0; j < curValues.length; j++) {
      values.push([
        curValues[j]['time'] * 1000,
        curValues[j]['price_fiat']
      ])
    }

    obj.push({
      key: key,
      values: values
    })
  }

  return obj;
};

/**
 * Creates stacked area chart using the data passed as a parameter.
 *
 * Data is first edited by {@link #modifyData}.
 *
 * @param data Data which will be parsed and added to chart.
 */
const addData = function (data) {
  data = modifyData(data);

  console.log(data);

  const margin = {right: 100};
  const timeFormat = d3.time.format("%H:%M:%S");

  const xMin = d3.min(data, function (d) {
    return Math.min(d[0]);
  });
  const xMax = d3.max(data, function (d) {
    return Math.max(d[0]);
  });
  const yMin = d3.min(data, function (d) {
    return Math.min(d[1]);
  });
  const yMax = d3.max(data, function (d) {
    return Math.max(d[1]);
  });

  nv.addGraph(function () {
    const chart = nv.models.stackedAreaChart()
      .x(function (d) {
        return d[0];
      })
      .y(function (d) {
        return d[1];
      })
      .margin(margin)
      .useInteractiveGuideline(true)
      .rightAlignYAxis(true)
      .showControls(true)
      .clipEdge(true);

    chart.xAxis.tickFormat(function (d) {
      timeFormat(new Date(d));
    });
    chart.forceY([xMin, xMax]);

    chart.yAxis.tickFormat(d3.format(',.2f'));
    chart.forceY([yMin, yMax]);

    d3.select('#line-chart')
      .datum(data)
      .call(chart);

    nv.utils.windowResize(chart.update);

    return chart;
  })
};
