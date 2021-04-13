import _ from 'lodash';

// @ts-ignore
import { QueryCtrl } from 'app/plugins/sdk';
// @ts-ignore
import { auto } from 'angular';

import './add_opennms_func';
import './func_editor';
import { Gfuncs } from './flow_functions';
import './css/query-editor.css';

export class FlowDatasourceQueryCtrl extends QueryCtrl {
  static templateUrl = 'datasources/flow-ds/partials/query.editor.html';

  error: any;
  functions = [] as any[];
  panelCtrl: any;
  segments = [] as any[];
  target = {} as any;

  scope: any;

  /** @ngInject */
  constructor($scope: any, $injector: auto.IInjectorService, public uiSegmentSrv) {
    super($scope, $injector);

    this.parseTarget();
  }

  refresh() {
    super.refresh();
  }

  parseTarget() {
    this.segments = [];
    this.functions = [];
    this.error = null;

    if (this.target) {
      if (this.target.metric) {
        this.segments.push(this.uiSegmentSrv.getSegmentForValue(this.target.metric));
      }

      if (this.target.functions) {
        this.functions = _.map(this.target.functions, function (f) {
          let funcDef = Gfuncs.getFuncDef(f.name);
          let func = Gfuncs.createFuncInstance(funcDef);
          for (let i = 0; i < f.parameters.length; i++) {
            func.updateParam(f.parameters[i], i);
          }
          return func;
        });
      }
    }

    if (this.segments.length === 0) {
      this.segments.push(this.uiSegmentSrv.newSelectMetric());
    }
  }

  updateModelTarget() {
    this.target.metric = this.segments.length > 0 ? this.segments[0].value : undefined;
    this.target.functions = _.map(this.functions, function (f) {
      return f.render();
    });
  }

  getAltSegments() {
    return Promise.resolve([
      { value: 'applications' },
      { value: 'conversations' },
      { value: 'hosts' },
      { value: 'dscps' },
    ]);
  }

  addFunction(funcDef) {
    let newFunc = Gfuncs.createFuncInstance(funcDef, { withDefaultParams: true });
    newFunc.added = true;
    this.functions.push(newFunc);
    this.targetChanged();
  }

  removeFunction(func) {
    this.functions = _.without(this.functions, func);
    this.targetChanged();
  }

  targetChanged() {
    if (this.error) {
      return;
    }

    let oldTarget = this.target.target;
    this.updateModelTarget();

    if (this.target.target !== oldTarget) {
      let lastSegment = this.segments.length > 0 ? this.segments[this.segments.length - 1] : {};
      if (lastSegment.value !== 'select metric') {
        this.panelCtrl.refresh();
      }
    }

    this.refresh();
  }

  refreshMetricData() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}
