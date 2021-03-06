import _ from 'lodash';

import { getValueFormats } from '@grafana/data';

import { defaultColors } from './alarmTableCtrl';
import { fontSizes } from './editor';

export const alignTypesEnum = [
  { text: 'auto', value: '' },
  { text: 'left', value: 'left' },
  { text: 'center', value: 'center' },
  { text: 'right', value: 'right' },
];

export interface TextValueTuple {
  text: string,
  value?: any,
}

export interface TextValueArray extends Array<TextValueTuple> {
};

export class ColumnOptionsCtrl {
  panel: any;
  panelCtrl: any;

  alignTypes: TextValueArray;
  colorModes: TextValueArray;
  columnTypes: TextValueArray;
  dateFormats: TextValueArray;
  mappingTypes: TextValueArray;

  activeStyleIndex: number;
  fontSizes = [...fontSizes];
  unitFormats: any;

  /** @ngInject */
  constructor($scope: any) {
    $scope.editor = this;

    this.activeStyleIndex = 0;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.unitFormats = getValueFormats();
    this.colorModes = [
      {text: 'Disabled', value: null},
      {text: 'Cell', value: 'cell'},
      {text: 'Value', value: 'value'},
      {text: 'Row', value: 'row'},
    ];
    this.columnTypes = [
      {text: 'Checkbox', value: 'checkbox'},
      {text: 'Number', value: 'number'},
      {text: 'String', value: 'string'},
      {text: 'Date', value: 'date'},
      {text: 'Severity', value:'severity'},
      {text: 'Hidden', value: 'hidden'}
    ];
    this.dateFormats = [
      {text: 'DD MMM HH:mm:ss', value: 'DD MMM HH:mm:ss'},
      {text: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss'},
      {text: 'YYYY-MM-DD HH:mm:ss.SSS', value: 'YYYY-MM-DD HH:mm:ss.SSS'},
      {text: 'MM/DD/YY h:mm:ss a', value: 'MM/DD/YY h:mm:ss a'},
      {text: 'MMMM D, YYYY LT', value: 'MMMM D, YYYY LT'},
      {text: 'YYYY-MM-DD', value: 'YYYY-MM-DD'},
      {text: 'relative', value: 'relative'},
      {text: 'relative (short)', value: 'relative-short'}
    ];
    this.mappingTypes = [
      { text: 'Value to text', value: 1 },
      { text: 'Range to text', value: 2 },
    ];
    this.alignTypes = _.cloneDeep(alignTypesEnum);

    this.onColorChange = this.onColorChange.bind(this);
  }

  getColumnNames(): string[] {
    if (!this.panelCtrl.table) {
      return [];
    }
    return _.map(this.panelCtrl.table.columns, (col) => {
      return col.text;
    });
  }

  render() {
    this.panelCtrl.render();
  }

  setUnitFormat(column, subItem) {
    column.unit = subItem.value;
    this.panelCtrl.render();
  }

  addColumnStyle() {
    const newStyleRule = {
      unit: 'short',
      type: 'number',
      alias: '',
      decimals: 2,
      colors: Array.prototype.concat([ ], defaultColors),
      colorMode: null,
      pattern: '',
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
      thresholds: [],
      mappingType: 1,
      align: 'auto',
      width: "",
      clip: false
    };

    const styles = this.panel.styles;
    const stylesCount = styles.length;
    let indexToInsert = stylesCount;

    // check if last is a catch all rule, then add it before that one
    if (stylesCount > 0) {
      const last = styles[stylesCount - 1];
      if (last.pattern === '/.*/') {
        indexToInsert = stylesCount - 1;
      }
    }

    styles.splice(indexToInsert, 0, newStyleRule);
    this.activeStyleIndex = indexToInsert;
  }

  removeColumnStyle(style) {
    this.panel.styles = _.without(this.panel.styles, style);
  }

  invertColorOrder(index) {
    const ref = this.panel.styles[index].colors;
    const copy = ref[0];
    ref[0] = ref[2];
    ref[2] = copy;
    this.panelCtrl.render();
  }

  onColorChange(style, colorIndex) {
    return (newColor) => {
      style.colors[colorIndex] = newColor;
      this.render();
    };
  }

  addValueMap(style) {
    if (!style.valueMaps) {
      style.valueMaps = [];
    }
    style.valueMaps.push({ value: '', text: '' });
    this.panelCtrl.render();
  }

  removeValueMap(style, index) {
    style.valueMaps.splice(index, 1);
    this.panelCtrl.render();
  }

  addRangeMap(style) {
    if (!style.rangeMaps) {
      style.rangeMaps = [];
    }
    style.rangeMaps.push({ from: '', to: '', text: '' });
    this.panelCtrl.render();
  }

  removeRangeMap(style, index) {
    style.rangeMaps.splice(index, 1);
    this.panelCtrl.render();
  }
}

/** @ngInject */
export function columnOptionsTab($q, uiSegmentSrv) { // eslint-disable-line no-unused-vars
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/plugins/opennms-helm-app/panels/alarm-table/column_options.html',
    controller: ColumnOptionsCtrl,
  };
}
