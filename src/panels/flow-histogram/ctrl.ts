/*eslint no-unused-vars: "warn"*/
/* eslint-disable no-restricted-imports */
import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import _ from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import 'jquery.flot';
import 'jquery.flot.time';
import 'jquery.flot.selection';
import 'jquery.flot.crosshair';
import 'jquery.flot.stack';
import 'flot-axislabels/jquery.flot.axislabels';
import 'flot/jquery.flot.categories';
import './legend';
import dataSeries = jquery.flot.dataSeries;

class HelmHistogramCtrl extends MetricsPanelCtrl {
  static templateUrl = 'panels/flow-histogram/module.html';

  $rootScope: any;
  scope: any;
  $timeout: any;
  panel: any;
  _renderRetries: number;
  typeChanged: boolean;
  hiddenSeries: {};
  retryTimes: number;
  retryDelay: number;
  events: any;
  elem: any;
  ctrl: any;
  series: any[] | undefined;
  units: any;
  seriesData: dataSeries[] | undefined;
  legendData: unknown[] | undefined;

  /** @ngInject */
  constructor($scope, $injector, $timeout, $rootScope) {
    super($scope, $injector);
    this.$rootScope = $rootScope;
    this.scope = $scope;
    this.$timeout = $timeout;

    // We use both the 'stack' and 'categories' Flot plugins
    // For these to work well together, we need the 'categories' plugin
    // to be called *before* the stack plugin.
    // Re-order them if necessary
    const categoriesPluginIdx = _.findIndex($.plot.plugins, (plugin) => {
      return plugin.name === 'categories';
    });
    const stackPluginIdx = _.findIndex($.plot.plugins, (plugin) => {
      return plugin.name === 'stack';
    });
    if (categoriesPluginIdx >= 0 && stackPluginIdx >= 0 && categoriesPluginIdx > stackPluginIdx) {
      // We found both plugins, and the categories plugin comes *after* the stack plugin, swap them
      const stackPlugin = $.plot.plugins[stackPluginIdx];
      $.plot.plugins[stackPluginIdx] = $.plot.plugins[categoriesPluginIdx];
      $.plot.plugins[categoriesPluginIdx] = stackPlugin;
    }

    _.defaults(this.panel, {
      direction: 'horizontal',
      units: 'b',
      display: 'total',
      mode: 'separate',
      legend: {
        show: true,
        sideWidth: 120,
        bottomHeight: 42,
      },
      legendType: 'Under graph',
      aliasColors: [],
    });

    this._renderRetries = 0;
    this.typeChanged = false;
    this.hiddenSeries = {};
    this.retryTimes = 10; // number of times to retry
    this.retryDelay = 100; // milliseconds, how long to wait to retry

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('render', this.onRender.bind(this));

    this.setLegendWidthForLegacyBrowser();
  }

  link($scope, elem, attrs, ctrl) {
    this.elem = elem.find('.flow-panel__chart');
    this.ctrl = ctrl;
  }

  onInitEditMode() {
    this.addEditorTab('Grouping', 'public/plugins/opennms-helm-app/panels/flow-histogram/editor.html', 2);
  }

  onDataReceived(data) {
    // Adjust the values based on the units selected
    if (data.length > 0) {
      const unitInfo = HelmHistogramCtrl.getUnits(data, this.panel.units);
      this.units = unitInfo.units;
      const labeledValues = this.getLabeledValues(data);
      this.series = this.getSeries(labeledValues, unitInfo.divisor);
      this.setData();
    }
    this.render();
  }

  onDataError() {
    this.series = [];
    this.render();
  }

  // @ts-ignore
  onRender() {
    this.elem.empty();

    let height = this.ctrl.height || this.ctrl.panel.height || (this.ctrl.row && this.ctrl.row.height);
    if (_.isString(height)) {
      height = parseInt(height.replace('px', ''), 10);
    }

    if (this.elem.width() === 0 || height === 0 || height === undefined) {
      if (this._renderRetries > this.retryTimes) {
        console.log('onRender: still unable to determine height, and we ran out of retries');
        return false;
      }
      this._renderRetries++;

      console.log('onRender: unable to determine height, retrying again in ' + this.retryDelay + 'ms');
      this.$timeout(() => {
        this.onRender();
      }, this.retryDelay);
      return true;
    }

    height -= 8; // subtract for panel title bar
    const legendHeight = this.getLegendHeight();
    height -= legendHeight;

    const plotCanvas = $('<div></div>');
    const plotCss = {
      margin: 'auto',
      position: 'relative',
      height: height + 'px',
    };
    this.elem.html(plotCanvas);
    plotCanvas.css(plotCss);

    if (this.panel.legendType === 'Right side' || this.typeChanged) {
      // Schedule to be called back to ensure we render after the legend renders for proper layout
      setTimeout(() => this.renderChart(plotCanvas), 0);
      this.typeChanged = false;
    } else {
      this.renderChart(plotCanvas);
    }
    this.ctrl.renderingCompleted();
  }

  renderChart(plotCanvas) {
    if (!this.series || this.series.length === 0) {
      this.noDataPoints();
    } else {
      if (plotCanvas.height() > 0 && plotCanvas.width() > 0) {
        const options = this.getOptions();
        this.setData();
        $.plot(plotCanvas, this.seriesData as dataSeries[], options);
      }
    }
  }

  getLabeledValues(data) {
    const dataElement = data[0];
    const metric = dataElement && dataElement.meta ? dataElement.meta.metric : undefined;
    let labelFunc;

    switch (metric) {
      case 'applications':
        labelFunc = (column, row) => {
          return row[column.indexOf('application')];
        };
        break;
      case 'hosts':
        labelFunc = (column, row) => {
          return row[column.indexOf('host')];
        };
        break;
      case 'conversations':
        labelFunc = (column, row) => {
          const applicationName = row[column.indexOf('application')];
          return (
            row[column.indexOf('source')] +
            ' <-> ' +
            row[column.indexOf('dest.')] +
            ' [' +
            (applicationName ? applicationName : 'Unknown') +
            ']'
          );
        };
        break;
    }

    if (!metric) {
      return {
        inByLabel: 'unknown',
        outByLabel: 'unknown',
      };
    }

    const toBits = dataElement && dataElement.meta ? dataElement.meta.toBits : null;
    let inByLabel = HelmHistogramCtrl.extractValueAndLabel(data, toBits ? 'Bits In' : 'Bytes In', 'In', labelFunc);
    let outByLabel = HelmHistogramCtrl.extractValueAndLabel(data, toBits ? 'Bits Out' : 'Bytes Out', 'Out', labelFunc);

    // Map the values to rates (average over the given time interval) if selected
    if (this.panel.display === 'rate') {
      this.units += '/s';
      let timeRangeInSeconds = moment.duration(this.range.to.diff(this.range.from)).asSeconds();
      inByLabel = _.map(inByLabel, (element) => {
        return {
          key: element.key,
          value: element.value / timeRangeInSeconds,
        };
      });

      outByLabel = _.map(outByLabel, (element) => {
        return {
          key: element.key,
          value: element.value / timeRangeInSeconds,
        };
      });
    }

    return {
      inByLabel: inByLabel,
      outByLabel: outByLabel,
    };
  }

  getSeries(values, divisor) {
    const inColor = '#86B15B';
    const outColor = '#DB4345';

    let series: any[] = [];

    switch (this.panel.direction) {
      case 'horizontal':
        for (let i = values.inByLabel.length - 1; i >= 0; i--) {
          series.push(HelmHistogramCtrl.generateResultObject(values.outByLabel, i, divisor, outColor));
          series.push(HelmHistogramCtrl.generateResultObject(values.inByLabel, i, divisor, inColor));
        }
        break;
      case 'vertical':
        for (let i = 0; i < values.inByLabel.length; i++) {
          series.push(HelmHistogramCtrl.generateResultObject(values.inByLabel, i, divisor, inColor));
          series.push(HelmHistogramCtrl.generateResultObject(values.outByLabel, i, divisor, outColor));
        }
        break;
    }

    return series;
  }

  getOptions() {
    // Set up the graph settings
    const series: any = {
      bars: {
        show: true,
        barWidth: 0.6,
        align: 'center',
        fill: 0.8,
        lineWidth: 1.0,
      },
      stack: this.panel.mode === 'stacked',
    };

    const axisSettings = {
      mode: 'categories',
      tickLength: 0,
      autoscaleMargin: 0.02,
    };

    const axisLabelSetting = [
      {
        axisLabel: this.units,
      },
    ];

    const options: any = {
      legend: {
        show: false,
      },
      axisLabels: {
        show: true,
      },
      series: series,
      grid: {
        borderWidth: 0,
      },
    };

    switch (this.panel.direction) {
      case 'horizontal':
        options.xaxes = axisLabelSetting;
        series.bars.horizontal = true;
        options.yaxis = axisSettings;
        break;

      case 'vertical':
        options.yaxes = axisLabelSetting;
        series.bars.horizontal = false;
        options.xaxis = axisSettings;
        break;
    }

    return options;
  }

  // @ts-ignore
  getSeriesData(series, direction, mode) {
    let dataFromSeries;

    switch (mode) {
      case 'separate': {
        dataFromSeries = HelmHistogramCtrl.getData(this.series, this.panel.direction);
        let inSeriesData: any = {
          label: 'In',
          bars: {
            show: true,
            barWidth: 0.2,
          },
          color: this.getColorForSeriesIndex(0),
        };

        if (!this.hiddenSeries[0]) {
          inSeriesData.data = dataFromSeries.dataIn;
        }

        let outSeriesData: any = {
          label: 'Out',
          bars: {
            show: true,
            barWidth: 0.2,
          },
          color: this.getColorForSeriesIndex(1),
        };

        if (!this.hiddenSeries[1]) {
          outSeriesData.data = dataFromSeries.dataOut;
        }

        switch (direction) {
          case 'horizontal':
            inSeriesData.bars.align = 'left';
            outSeriesData.bars.align = 'right';
            return [inSeriesData, outSeriesData];
          case 'vertical':
            inSeriesData.bars.align = 'right';
            outSeriesData.bars.align = 'left';
            return [outSeriesData, inSeriesData];
        }
        break;
      }
      case 'stacked': {
        dataFromSeries = HelmHistogramCtrl.getDataStacked(this.series, this.panel.direction);
        let stackedSeriesData: any[] = [];
        let seriesIndex = 0;
        for (const key of Object.keys(dataFromSeries)) {
          let item: any = {
            label: key,
            color: this.getColorForSeriesIndex(seriesIndex),
          };
          if (!this.hiddenSeries[seriesIndex++]) {
            item.data = dataFromSeries[key];
          }
          stackedSeriesData.push(item);
        }

        return stackedSeriesData;
      }
    }
  }

  setData() {
    this.seriesData = this.getSeriesData(this.series, this.panel.direction, this.panel.mode);
    this.legendData = this.getLegendData(this.seriesData, this.panel.direction, this.panel.mode);
  }

  getLegendData(seriesData, direction, mode) {
    let seriesIndex = 0;
    if (direction === 'vertical' && mode === 'separate') {
      // In this case we need to reverse the order of the labels
      let legendData: any[] = [];
      for (let i = seriesData.length - 1; i >= 0; i--) {
        let serie = seriesData[i];
        legendData.push({
          label: serie.label,
          color: this.getColorForSeriesIndex(seriesIndex++),
        });
      }
      return legendData;
    }

    return _.map(seriesData, (serie) => {
      return {
        label: serie.label,
        color: this.getColorForSeriesIndex(seriesIndex++),
      };
    });
  }

  getColorForSeriesIndex(index) {
    return this.panel.aliasColors[index] ? this.panel.aliasColors[index] : this.$rootScope.colors[index];
  }

  changeSeriesColor(index, color) {
    this.panel.aliasColors[index] = color;
    this.render();
  }

  toggleSeries(index) {
    if (this.hiddenSeries[index]) {
      delete this.hiddenSeries[index];
    } else {
      this.hiddenSeries[index] = true;
    }
    this.render();
  }

  onLegendTypeChanged() {
    this.setLegendWidthForLegacyBrowser();
    this.typeChanged = true;
    this.render();
  }

  setLegendWidthForLegacyBrowser() {
    const isIE11 = !!window.MSInputMethodContext && !!(document as any).documentMode;
    if (isIE11 && this.panel.legendType === 'Right side' && !this.panel.legend.sideWidth) {
      this.panel.legend.sideWidth = 150;
    }
  }

  getLegendHeight() {
    if (!this.panel.legend.show || this.panel.legendType === 'Right side') {
      return 0;
    }

    if (this.panel.legendType === 'Under graph') {
      return this.panel.legend.bottomHeight;
    }
  }

  noDataPoints() {
    this.elem.html('<div class="datapoints-warning"><span class="small">No data points</span></div>');
  }

  static getData(series, direction) {
    let dataIn: any[] = [];
    let dataOut: any[] = [];

    switch (direction) {
      case 'horizontal':
        for (let i = 0, j = 1; i < series.length - 1; i += 2, j += 2) {
          dataOut.push([series[i].count, series[i].name]);
          dataIn.push([series[j].count, series[j].name]);
        }
        break;
      case 'vertical':
        for (let i = 0, j = 1; i < series.length - 1; i += 2, j += 2) {
          dataIn.push([series[i].name, series[i].count]);
          dataOut.push([series[j].name, series[j].count]);
        }
        break;
    }

    return {
      dataIn: dataIn,
      dataOut: dataOut,
    };
  }

  static getDataStacked(series, direction) {
    let perHostData = {};

    switch (direction) {
      case 'horizontal':
        for (let i = series.length - 2, j = series.length - 1; i >= 0; i -= 2, j -= 2) {
          perHostData[series[i].name] = [];
          perHostData[series[i].name].push([series[i].count, 'Out']);
          perHostData[series[i].name].push([series[j].count, 'In']);
        }
        break;
      case 'vertical':
        for (let i = 0, j = 1; i < series.length - 1; i += 2, j += 2) {
          perHostData[series[i].name] = [];
          perHostData[series[i].name].push(['In', series[i].count]);
          perHostData[series[i].name].push(['Out', series[j].count]);
        }
        break;
    }

    return perHostData;
  }

  static extractValueAndLabel(data, valueColumn, direction, labelFunc) {
    const values: any[] = [];

    if (!data || !data[0] || !data[0].columns) {
      return values;
    }

    const columns = data[0].columns.map((col) => col.text.toLowerCase());
    const valueColumnIndex = columns.indexOf(valueColumn.toLowerCase());

    if (data[0].rows) {
      data[0].rows.forEach((row) => {
        values.push({
          key: labelFunc(columns, row),
          value: row[valueColumnIndex],
        });
      });
    }

    return values;
  }

  static getUnits(data, panelUnits) {
    const dataElement = data[0];
    const toBits = dataElement && dataElement.meta ? dataElement.meta.toBits : null;
    let divisor = 1;
    let units;
    switch (panelUnits) {
      case 'b':
        units = toBits ? 'Bits' : 'Bytes';
        break;
      case 'kb':
        divisor = 1024;
        units = toBits ? 'Kb' : 'KB';
        break;
      case 'mb':
        divisor = 1024 ** 2;
        units = toBits ? 'Mb' : 'MB';
        break;
      case 'gb':
        divisor = 1024 ** 3;
        units = toBits ? 'Gb' : 'GB';
        break;
    }

    return {
      divisor: divisor,
      units: units,
    };
  }

  static generateResultObject(data, i, divisor, color) {
    return {
      name: data[i].key,
      count: _.defaultTo(data[i].value, 0) / divisor,
      color: color,
    };
  }
}

export { HelmHistogramCtrl };
