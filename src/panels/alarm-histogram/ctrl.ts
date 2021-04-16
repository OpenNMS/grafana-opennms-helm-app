import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import _ from 'lodash';
import $ from 'jquery';
import 'jquery.flot';
import 'jquery.flot.selection';
import 'jquery.flot.crosshair';
import 'flot/jquery.flot.categories';

class AlarmHistogramCtrl extends MetricsPanelCtrl {
  static templateUrl = 'panels/alarm-histogram/module.html';

  _renderRetries: number;
  retryTimes: number;
  retryDelay: number;
  series: Array<{ color: any; name: string; count: number }> | undefined;
  elem: any;
  ctrl: any;

  /** @ngInject */
  constructor($scope, $injector, $timeout) {
    super($scope, $injector);

    this.scope = $scope;
    this.$timeout = $timeout;

    this._renderRetries = 0;

    _.defaults(this.panel, {
      groupProperty: 'acknowledged',
      direction: 'horizontal',
    });

    this.retryTimes = 10; // number of times to retry
    this.retryDelay = 100; // milliseconds, how long to wait to retry

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('render', this.onRender.bind(this));
  }

  link($scope, elem, attrs, ctrl) {
    this.elem = elem.find('.histogram-chart');
    this.ctrl = ctrl;
  }

  onInitEditMode() {
    this.addEditorTab('Grouping', 'public/plugins/opennms-helm-app/panels/alarm-histogram/editor.html', 2);
  }

  onDataReceived(data) {
    switch (this.panel.groupProperty) {
      case 'acknowledged': {
        const counts = _.countBy(this.query(data, 'Acked By'), (a) => _.isNil(a).toString());
        this.series = [
          {
            name: 'Outstanding',
            count: _.defaultTo(counts['true'], 0),
            color: this.scope.$root.colors[0],
          },
          {
            name: 'Acknowledged',
            count: _.defaultTo(counts['false'], 0),
            color: this.scope.$root.colors[4],
          },
        ];
        break;
      }

      case 'severity': {
        const counts = _.countBy(this.query(data, 'Severity'));
        this.series = [
          {
            name: 'Cleared',
            count: _.defaultTo(counts['CLEARED'], 0),
            color: '#EEE000',
          },
          {
            name: 'Normal',
            count: _.defaultTo(counts['NORMAL'], 0),
            color: '#86B15B',
          },
          {
            name: 'Indeterm.',
            count: _.defaultTo(counts['INDETERMINATE'], 0),
            color: '#990000',
          },
          {
            name: 'Warning',
            count: _.defaultTo(counts['WARNING'], 0),
            color: '#FCCC3B',
          },
          {
            name: 'Minor',
            count: _.defaultTo(counts['MINOR'], 0),
            color: '#EE901C',
          },
          {
            name: 'Major',
            count: _.defaultTo(counts['MAJOR'], 0),
            color: '#E3692F',
          },
          {
            name: 'Critical',
            count: _.defaultTo(counts['CRITICAL'], 0),
            color: '#DB4345',
          },
        ];
        break;
      }
    }

    this.render();
  }

  onDataError() {
    this.series = [];
    this.render();
  }

  // @ts-ignore
  onRender() {
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

    height -= 5; // padding
    height -= this.ctrl.panel.title ? 24 : 9; // subtract panel title bar

    this.elem.css('height', height + 'px');

    // Draw graph
    switch (this.panel.direction) {
      case 'horizontal':
        $.plot(
          this.elem,
          _.map(this.series, function (serie) {
            return {
              data: [[serie.count, serie.name]],
              color: serie.color,
            };
          }),
          {
            series: {
              bars: {
                show: true,
                barWidth: 0.6,
                align: 'center',
                fill: 0.8,
                lineWidth: 1.0,
                horizontal: true,
              },
            },
            yaxis: {
              mode: 'categories',
              tickLength: 0,
              autoscaleMargin: 0.02,
            },
            grid: {
              borderWidth: 0,
            },
          }
        );
        break;

      case 'vertical':
        $.plot(
          this.elem,
          _.map(this.series, function (serie) {
            return {
              data: [[serie.name, serie.count]],
              color: serie.color,
            };
          }),
          {
            series: {
              bars: {
                show: true,
                barWidth: 0.5,
                align: 'center',
                fill: 0.8,
                lineWidth: 1.0,
                horizontal: false,
              },
            },
            xaxis: {
              mode: 'categories',
              tickLength: 0,
              autoscaleMargin: 0.02,
            },
            grid: {
              borderWidth: 0,
            },
          }
        );
        break;
    }
    this.ctrl.renderingCompleted();
  }

  query(data, column) {
    // TODO: Make this a generator to save memory
    let result: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const columnIndex = _.findIndex(data[i].columns, { text: column });
      const rows = data[i] && data[i].rows ? data[i].rows : [];
      for (let j = 0; j < rows.length; j++) {
        result.push(data[i].rows[j][columnIndex]);
      }
    }

    return result;
  }
}

export { AlarmHistogramCtrl };
