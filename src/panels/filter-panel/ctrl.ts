import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';
import { filterPanelEditor } from './editor';
import _ from 'lodash';

import { FilterColumn } from '../../lib/filter_column';

class FilterCtrl extends MetricsPanelCtrl {
  static templateUrl = 'panels/filter-panel/module.html';

  datasourceSrv: any;
  templateSrv: any;
  timeSrv: any;
  $q: any;
  $injector: any;
  variableSrv: any;
  columnData: any;
  panel: any;
  $scope: any;
  events: any;
  dashboard: any;
  datasource: any;
  ctrl: any;
  /** @ngInject */
  constructor($scope, $q, $injector, datasourceSrv, templateSrv, timeSrv) {
    super($scope, $injector);

    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.timeSrv = timeSrv;
    this.$q = $q;

    if (this.$injector.has('variableSrv')) {
      this.variableSrv = this.$injector.get('variableSrv');
    }

    _.defaults(this.panel, {
      columns: [],
    });
    this.columnData = {};

    if (this.panel.datasources) {
      // upgrade existing column format
      for (const col of this.panel.columns) {
        if (this.panel.selected && this.panel.selected[col.label]) {
          col.selected = this.panel.selected[col.label];
        }
        if (this.panel.inputTypes && this.panel.inputTypes[col.label]) {
          col.inputType = this.panel.inputTypes[col.label];
        }
        if (this.panel.datasources && this.panel.datasources[col.label]) {
          col.datasource = this.panel.datasources[col.label];
        }
      }
      delete this.panel.selected;
      delete this.panel.inputTypes;
      delete this.panel.datasources;
    }

    this.$scope.dashboard = this.dashboard;
    this.$scope.ctrl = this;
    this.$scope.columnVariables = [];
    this.panel.columns = this.panel.columns.map((col) => FilterColumn.fromJSON(col));

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render', this.onRender.bind(this));
    this.render();
  }

  link($scope, elem, attrs, ctrl) {
    this.ctrl = ctrl;
    this.$scope = $scope;
  }

  onInitEditMode() {
    this.addEditorTab('Filtering', filterPanelEditor, 2);
  }

  onRender() {
    const self = this;
    this.panel.columns = this.panel.columns.map((column) => this.enrichColumn(column));
    this.$scope.columns = this.panel.columns;
    return this.updateVariables().then(() => {
      return self.ctrl.renderingCompleted();
    });
  }

  updateVariables() {
    return this.$q.all(this.$scope.columns.map((column, index) => this.getVariable(column))).then((cols) => {
      this.$scope.columnVariables = cols;
      return cols;
    });
  }

  variableChanged(col) {
    if (col && col.text) {
      this.doPanelRefresh();
    }
  }

  enrichColumn(obj) {
    if (obj instanceof FilterColumn) {
      return obj;
    }
    return new FilterColumn(
      obj.text,
      obj.label,
      obj.datasource,
      obj.resource,
      obj.inputType,
      obj.entityType,
      obj.id,
      obj.selected
    );
  }

  getVariable(column /*, index */) {
    const label = column.text;
    const resource = column.resource;

    let query;

    const filterColumn = this.enrichColumn(column);
    if (this.variableSrv) {
      filterColumn.type = column.inputType === 'text' ? 'textbox' : 'query';
      filterColumn.multi = column.inputType === 'multi' || column.inputType === undefined;
      query = this.variableSrv.createVariableFromModel(filterColumn);
    } else {
      // grafana 7
      query = filterColumn.toModel(this.$injector);
    }
    query = filterColumn.toModel(this.$injector);

    const selected = column.selected;
    if (selected) {
      query.options.forEach((opt) => {
        if (Array.isArray(selected.value)) {
          opt.selected = selected.value.contains(opt.value);
        }
      });
      query.current = selected;
      if (query.current) {
        query.current.resource = resource;
      }
    }

    query.datasource = column.datasource || this.datasource.name;
    query.multi = column.inputType === 'multi' || column.inputType === undefined;
    query.inputType = column.inputType;
    query.entityType = column.entityType;

    if (column.inputType === 'text') {
      if (selected && selected.value !== null && selected.value !== undefined) {
        query.query = selected.value;
      }
    } else {
      query.includeAll = true;
      query.query = resource;

      // if this is an entity query, wrap in the entity type
      if (query.entityType && query.entityType.id) {
        query.query = column.entityType.queryFunction + '(' + resource + ')';
      }
    }

    query.label = label;
    query.resource = resource;
    query.id = column.id;

    return query.updateOptions().then(() => {
      if (selected) {
        query.setValue(selected);
      }
      return query;
    });
  }

  variableUpdated(variable, index) {
    return variable.updateOptions().then(() => {
      if (variable.current) {
        variable.current.resource = variable.resource;
        variable.current.datasource = variable.datasource;
        variable.current.inputType = variable.inputType;
        variable.current.entityType = variable.entityType;
      }
      this.panel.columns[index].selected = variable.current;

      return this.doPanelRefresh();
    });
  }

  doPanelRefresh() {
    const self = this;
    return this.$q
      .all(
        this.dashboard.panels
          .filter((panel) => panel !== self.panel)
          .map((panel) => {
            return panel.refresh();
          })
      )
      .then(() => {
        return this.$q.all(this.render(), this.dashboard.render());
      });
  }
}

export { FilterCtrl };
