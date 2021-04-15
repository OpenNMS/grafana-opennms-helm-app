import _ from 'lodash';
import $ from 'jquery';

import { dateTimeAsMoment, isDateTime, isTableData } from '@grafana/data';
import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';

import { config } from '@grafana/runtime';
import { transformDataToTable } from './transformers';
import { tablePanelEditor } from './editor';
import { columnOptionsTab } from './column_options';
import { TableRenderer } from './renderer';
import { SelectionMgr } from './selection_mgr';
import { ActionMgr } from './action_mgr';

import { grafanaResource } from '../../lib/grafana_resource';
const PanelEvents = grafanaResource('PanelEvents');

import * as XLSX from 'xlsx';

export const defaultColors = ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'];
const doubleClickDelay = 250;

const styles = {
  ack: {
    type: 'checkbox',
    alias: 'Ack',
    pattern: 'Is Acknowledged',
    align: 'center',
    width: '2em',
    clip: true,
  },
  count: {
    unit: 'short',
    type: 'number',
    decimals: 0,
    colors: Array.prototype.concat([], defaultColors),
    colorMode: null,
    pattern: '/Count/',
    align: 'right',
    width: '3em',
  },
  dateTime: {
    type: 'date',
    pattern: '/(.*Time|Suppressed Until)/', // Render all Time columns as date, e.g. "Last Event Time", "First Event Time", etc.
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    align: 'center',
    width: '6em',
  },
  defaultString: {
    type: 'string',
    pattern: '/.*/',
  },
  description: {
    type: 'string',
    pattern: 'Description',
    sanitize: true,
  },
  id: {
    type: 'string',
    pattern: '/.*ID/', // Render all "* ID" columns as string, otherwise ID 1000 appears as 1.0 K
  },
  lastEventTime: {
    type: 'date',
    pattern: '/Last Event Time/',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    align: 'center',
    width: '5em',
    alias: 'Last Occurrence',
    clip: true,
  },
  location: {
    type: 'string',
    pattern: 'Location',
    clip: true,
    width: '5em',
  },
  logMessage: {
    type: 'string',
    pattern: 'Log Message',
    alias: 'Message',
    sanitize: true,
    clip: true,
    width: '30em',
  },
  node: {
    type: 'string',
    pattern: 'Node Label',
    alias: 'Node',
    width: '12em',
  },
  severity: {
    type: 'severity',
    pattern: 'Severity',
    displayAs: 'icon',
    align: 'center',
    clip: true,
    width: '3em',
  },
};

class AlarmTableCtrl extends MetricsPanelCtrl {
  static templateUrl = 'panels/alarm-table/module.html';

  $rootScope: any;
  annotationsSrv: any;
  $compile: any;
  $sanitize: any;
  variableSrv: any;
  selectionMgr: any;
  pageIndex: number;
  backendSrv: any;
  table: any;
  dataRaw: any;
  newDataRaw: any;
  renderer: any;
  appConfig: any;
  clicks: any;

  /** @ngInject */
  constructor(
    $scope,
    $injector,
    $rootScope,
    annotationsSrv,
    $sanitize,
    $compile,
    backendSrv,
    datasourceSrv,
    templateSrv,
    timeSrv
  ) {
    super($scope, $injector);
    this.$rootScope = $rootScope;
    this.annotationsSrv = annotationsSrv;
    this.$sanitize = $sanitize;
    this.$compile = $compile;
    this.backendSrv = backendSrv;
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.timeSrv = timeSrv;

    if ($injector.has('variableSrv')) {
      this.variableSrv = $injector.get('variableSrv');
    }

    let panelDefaults = {
      targets: [{}],
      transform: 'table',
      pageSize: 10,
      pagingPausesRefresh: false,
      showHeader: true,
      styles: [
        styles.severity,
        styles.lastEventTime,
        styles.dateTime,
        styles.id,
        styles.description,
        styles.logMessage,
        styles.count,
        styles.node,
        styles.ack,
        styles.location,
        styles.defaultString,
      ],
      columns: [
        {
          title: 'Ack',
          text: 'Is Acknowledged',
          style: styles.ack,
        },
        {
          title: 'Severity',
          text: 'Severity',
          style: styles.severity,
        },
        {
          title: 'Count',
          text: 'Count',
          style: styles.count,
        },
        {
          title: 'Last Occurrence',
          text: 'Last Event Time',
          style: styles.lastEventTime,
        },
        {
          title: 'Location',
          text: 'Location',
          style: styles.location,
        },
        {
          title: 'Node',
          text: 'Node Label',
          style: styles.node,
        },
        {
          title: 'Message',
          text: 'Log Message',
          style: styles.logMessage,
        },
      ],
      scroll: false, // disable scrolling as the actions popup is not working properly otherwise
      fontSize: '100%',
      sort: { col: 3, desc: true },
      severity: 'column',
    };

    this.pageIndex = 0;

    if (this.panel.styles === void 0) {
      this.panel.styles = this.panel.columns;
      this.panel.columns = this.panel.fields;
      delete this.panel.columns;
      delete this.panel.fields;
    }

    _.defaults(this.panel, panelDefaults);

    if (this.panel.styles) {
      this.panel.styles.forEach((style) => {
        if (style.type === 'number') {
          if (!style.colors) {
            style.colors = Array.prototype.concat([], defaultColors);
          }
          if (style.colorMode === undefined) {
            style.colorMode = null;
          }
        }
      });
    }

    let self = this;
    this.selectionMgr = new SelectionMgr(
      (from, to) => self.getRowsInRange(from, to),
      () => self.render()
    );
    this.events.on(PanelEvents ? PanelEvents.dataReceived : 'data-received', this.onDataReceived.bind(this));
    this.events.on(PanelEvents ? PanelEvents.dataError : 'data-error', this.onDataError.bind(this));
    this.events.on(PanelEvents ? PanelEvents.dataSnapshotLoad : 'data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on(PanelEvents ? PanelEvents.editModeInitialized : 'init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on(
      PanelEvents ? PanelEvents.initPanelActions : 'init-panel-actions',
      this.onInitPanelActions.bind(this)
    );

    if (this.panel.severity === true) {
      this.panel.severity = 'row';
    }

    if (this.panel.severityIcons === true) {
      delete this.panel.severityIcons;
      if (this.panel.sort && this.panel.sort.col !== undefined) {
        this.panel.sort.col++;
      }
      this.panel.styles.unshift({
        type: 'severity',
        pattern: 'Severity',
        displayAs: 'icon',
      });
      this.panel.columns.unshift({
        hidden: false,
        text: 'Severity',
        title: 'Severity',
        style: {
          type: 'severity',
          pattern: 'Severity',
          displayAs: 'icon',
        },
      });
      if (this.table && this.table.rows) {
        // put a placeholder value in until data refreshes
        this.table.rows = this.table.rows.map((row) => {
          row.unshift(undefined);
        });
      }
    }

    self.refreshAppConfig();
  }

  refreshAppConfig() {
    const self = this;
    self.backendSrv.get('api/plugins/opennms-helm-app/settings').then((result) => {
      if (result && result.jsonData) {
        self.appConfig = result.jsonData;
      } else {
        console.warn('No settings found.');
      }
    });
  }

  onInitEditMode() {
    this.addEditorTab('Options', tablePanelEditor, 2);
    this.addEditorTab('Column Styles', columnOptionsTab, 3);
  }

  onInitPanelActions(actions) {
    actions.push({ text: 'Export CSV', click: 'ctrl.exportCSV()' });
    actions.push({ text: 'Export Excel', click: 'ctrl.exportExcel()' });
  }

  issueQueries(datasource) {
    if (this.panel.transform === 'annotations') {
      if (this.setTimeQueryStart) {
        this.setTimeQueryStart();
      }
      return this.annotationsSrv
        .getAnnotations({
          dashboard: this.dashboard,
          panel: this.panel,
          range: this.range,
        })
        .then((annotations) => {
          return { data: annotations };
        });
    }

    return super.issueQueries(datasource);
  }

  onDataError() {
    this.dataRaw = [];
    this.render();
  }

  onDataReceived(dataList) {
    this.newDataRaw = dataList;

    if (!this.panel.pagingPausesRefresh || this.pageIndex === 0 || !this.dataRaw || this.dataRaw.length === 0) {
      this.updateData();
    }

    this.render();
  }

  refreshData() {
    this.updateData();
    this.scope.$evalAsync(() => {
      this.render();
    });
  }

  updateData() {
    this.dataRaw = this.newDataRaw;
    delete this.newDataRaw;

    // automatically correct transform mode based on data
    if (this.dataRaw && this.dataRaw.length) {
      if (isTableData(this.dataRaw[0])) {
        this.panel.transform = 'table';
      } else {
        if (this.dataRaw[0].type === 'docs') {
          this.panel.transform = 'json';
        } else {
          if (this.panel.transform === 'table' || this.panel.transform === 'json') {
            this.panel.transform = 'timeseries_to_rows'; // we had overridden this to 'table', not sure why?
          }
        }
      }
    }
    this.pageIndex = 0;
  }

  render() {
    this.table = transformDataToTable(this.dataRaw, this.panel);
    this.table.sort(this.panel.sort);

    this.renderer = new TableRenderer(
      this.panel,
      this.table,
      this.dashboard.getTimezone() === 'utc',
      this.$sanitize,
      this.selectionMgr,
      this.templateSrv,
      config.theme.type
    );

    return super.render(this.table);
  }

  _getWorkbook() {
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: this.panel.title,
    };

    const columns = this.table.columns.map((col) => {
      return col.text;
    });
    const rows = this.table.rows.map((row) => {
      const ret = {};
      row.forEach((col, index) => {
        if (isDateTime(col)) {
          ret[columns[index]] = dateTimeAsMoment(col).format('YYYY-MM-DD HH:mm:ss.SSS');
        } else {
          ret[columns[index]] = col;
        }
      });
      return ret;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
    XLSX.utils.book_append_sheet(workbook, worksheet, this.panel.title);
    return workbook;
  }

  exportCSV() {
    const workbook = this._getWorkbook();
    XLSX.writeFile(workbook, this.panel.title + '.csv');
  }

  exportExcel() {
    const workbook = this._getWorkbook();
    XLSX.writeFile(workbook, this.panel.title + '.xlsx');
  }

  toggleColumnSort(col, colIndex) {
    // remove sort flag from current column
    if (this.table.columns[this.panel.sort.col]) {
      this.table.columns[this.panel.sort.col].sort = false;
    }

    if (this.panel.sort.col === colIndex) {
      if (this.panel.sort.desc) {
        this.panel.sort.desc = false;
      } else {
        this.panel.sort.col = null;
      }
    } else {
      this.panel.sort.col = colIndex;
      this.panel.sort.desc = true;
    }
    this.render();
  }

  link(scope, elem, attrs, ctrl) {
    let data;
    const panel = ctrl.panel;
    let pageCount = 0;
    let self = this;

    scope.getColumnStyle = (col) => {
      const ret = {};
      if (col && col.style) {
        if (col.style.width !== undefined) {
          ret['width'] = col.style.width;
          if (col.style.clip) {
            ret['max-width'] = col.style.width;
            ret['white-space'] = 'nowrap';
          }
        }
        if (col.style.clip) {
          ret['overflow'] = 'hidden';
          ret['text-overflow'] = 'ellipsis';
          ret['white-space'] = 'nowrap';
        }
      }
      return ret;
    };

    function getTableHeight() {
      let panelHeight = ctrl.height;

      if (pageCount > 1) {
        panelHeight -= 26;
      }

      return panelHeight - 31 + 'px';
    }

    function appendTableRows(tbodyElem) {
      ctrl.renderer.setTable(data);
      tbodyElem.empty();
      tbodyElem.html(ctrl.renderer.render(ctrl.pageIndex));
      // Compile the HTML generated by the renderer - this is required the row related callbacks (click, dblclick, etc...)
      ctrl.$compile(tbodyElem.contents())(scope);
    }

    function switchPage(e) {
      const el = $(e.currentTarget);
      ctrl.pageIndex = parseInt(el.text(), 10) - 1;
      renderPanel();
    }

    function appendPaginationControls(footerElem) {
      footerElem.empty();

      const pageSize = panel.pageSize || 100;
      pageCount = Math.ceil(data.rows.length / pageSize);
      if (pageCount === 1) {
        return;
      }

      const startPage = Math.max(ctrl.pageIndex - 3, 0);
      const endPage = Math.min(pageCount, startPage + 9);

      const paginationList = $('<ul></ul>');

      for (let i = startPage; i < endPage; i++) {
        const activeClass = i === ctrl.pageIndex ? 'active' : '';
        const pageLinkElem = $(
          '<li><a class="table-panel-page-link pointer ' + activeClass + '">' + (i + 1) + '</a></li>'
        );
        paginationList.append(pageLinkElem);
      }

      if (ctrl.newDataRaw) {
        paginationList.append(
          $(
            '<li><a class="table-panel-page-refresh pointer" name="refresh"><i class="fa fa-refresh" aria-hidden="true"></i> refresh</a></li>'
          )
        );
      }
      footerElem.append(paginationList);
    }

    function refreshData() {
      ctrl.refreshData();
    }

    function renderPanel() {
      const panelElem = elem.parents('.panel-content');
      const rootElem = elem.find('.table-panel-scroll');
      const tbodyElem = elem.find('tbody');
      const footerElem = elem.find('.table-panel-footer .pagination');

      elem.css({ 'font-size': panel.fontSize });
      panelElem.addClass('table-panel-content');

      appendTableRows(tbodyElem);
      appendPaginationControls(footerElem);

      rootElem.css({ 'max-height': panel.scroll ? getTableHeight() : '' });
    }

    // hook up link tooltips
    elem.tooltip({
      selector: '[data-link-tooltip]',
    });

    function setFilter(options) {
      if (self.variableSrv) {
        ctrl.variableSrv.setAdhocFilter(options);
      } else {
        // assume grafana 7+
        self.$rootScope.appEvent('alert-error', [
          'Ad-Hoc Filters Not Supported',
          'Ad-hoc alarm table filters are not supported on Grafana 7.',
        ]);
      }
    }

    function addFilterClicked(e) {
      const filterData = $(e.currentTarget).data();
      const options = {
        datasource: panel.datasource,
        key: data.columns[filterData.column].text,
        value: data.rows[filterData.row][filterData.column],
        operator: filterData.operator,
      };

      setFilter(options);
    }

    elem.on('click', '.table-panel-page-link', switchPage);
    elem.on('click', '.table-panel-filter-link', addFilterClicked);
    elem.on('click', '.table-panel-page-refresh', refreshData);

    const unbindDestroy = scope.$on('$destroy', function () {
      elem.off('click', '.table-panel-page-link');
      elem.off('click', '.table-panel-filter-link');
      elem.off('click', '.table-panel-page-refresh');
      unbindDestroy();
    });

    ctrl.events.on(PanelEvents ? PanelEvents.render : 'render', (renderData) => {
      data = renderData || data;
      if (data) {
        renderPanel();
      }
      ctrl.renderingCompleted();
    });
  }

  // Alarm related actions

  findRowAndMeta(source, alarmId) {
    let matchedRow;
    let matchedMeta;
    _.each(this.dataRaw, (table) => {
      if (table.meta && table.meta.entity_metadata) {
        const rowIdx = _.findIndex(table.meta.entity_metadata, (meta) => {
          return (meta as any).source === source && (meta as any).alarm.id === alarmId;
        });
        const filteredRow = table.rows[rowIdx];
        if (filteredRow !== undefined) {
          matchedRow = filteredRow;
          matchedMeta = table.meta.entity_metadata[rowIdx];
        }
      }
    });
    if (matchedRow) {
      return {
        row: matchedRow,
        meta: matchedMeta,
      };
    }
    return null;
  }

  getContextMenu($event, source, alarmId) {
    // Treat the right click as a left click on the row, if the row is not part of the current selection
    if (
      !this.selectionMgr.isRowSelected({
        source: source,
        alarmId: alarmId,
      })
    ) {
      this.onSingleClick($event, source, alarmId);
    }

    // Grab the current selection
    let selectedRows = this.selectionMgr.getSelectedRows();

    // Load up the actual alarms in the rows
    let self = this;
    selectedRows = _.map(selectedRows, (row) => {
      // Create new objects instead of modifying the existing rows
      // returned by SelectionMgr#getSelectedRows()
      const tableRow = self.findRowAndMeta(row.source, row.alarmId);
      return Object.assign({}, row, {
        alarm: tableRow && tableRow.meta ? tableRow.meta.alarm : undefined,
        ticketerConfig: tableRow && tableRow.meta ? tableRow.meta.ticketerConfig : undefined,
      });
    });

    // Filter out any rows for which we couldn't find the alarm
    selectedRows = _.filter(selectedRows, (row) => row.alarm !== void 0);

    // Generate selection-based context menu
    return new ActionMgr(this, selectedRows, this.appConfig).getContextMenu();
  }

  scheduleClickCheck($event, source, alarmId, clickTime) {
    const self = this;
    if (!self.clicks) {
      self.clicks = {};
    }

    const thisEvent = $event;
    const alarmClick = self.clicks[alarmId] || {};

    // always handle left-click, because if we're double-clicking, it's OK to deselect everything anyways
    if (thisEvent.button !== 2) {
      self.onSingleClick(thisEvent, source, alarmId);
    }

    clearTimeout(alarmClick.timeout);
    alarmClick.timeout = setTimeout(() => {
      if (self.clicks[alarmId] && self.clicks[alarmId].lastClick === clickTime) {
        if (thisEvent.button === 2) {
          // right click
          self.getContextMenu(thisEvent, source, alarmId);
        } else {
          // left click was already handled
        }
      } else {
        // pre-scheduled click time does not match last click; assuming double-click'
      }
    }, doubleClickDelay);
  }

  onRowClick($event, source, alarmId) {
    const self = this;
    if (!self.clicks) {
      self.clicks = {};
    }

    const now = Date.now();
    const thisEvent = $event;

    if (self.clicks[alarmId]) {
      const delay = now - self.clicks[alarmId].lastClick;

      if (delay < doubleClickDelay) {
        // on a double click, delete previous record and trigger the double-click action
        delete self.clicks[alarmId];
        self.onDoubleClick(thisEvent, source, alarmId);
      } else {
        // delay is too long, this is a single click now
        self.scheduleClickCheck(thisEvent, source, alarmId, now);
      }
    } else {
      // no previous click record, create a fresh one and schedule a click check
      self.clicks[alarmId] = {
        timeout: undefined,
      };
      self.scheduleClickCheck(thisEvent, source, alarmId, now);
    }
    if (self.clicks[alarmId]) {
      self.clicks[alarmId].lastClick = now;
    }
  }

  onSingleClick($event, source, alarmId) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const exclusiveModifier = isMac ? $event.metaKey : $event.ctrlKey;
    const rangeModifier = $event.shiftKey;
    this.selectionMgr.handleRowClick({ source: source, alarmId: alarmId }, exclusiveModifier, rangeModifier);
  }

  onDoubleClick($event, source, alarmId) {
    this.selectionMgr.handleSelection([], false);
    // Show the alarm details pane
    this.alarmDetails(source, alarmId);
  }

  alarmDetails(source, alarmId) {
    const row = this.findRowAndMeta(source, alarmId);
    if (!row) {
      this.$rootScope.appEvent('alert-error', ['Unable to find matching alarm', '']);
      return;
    }

    let newScope = this.$rootScope.$new();
    newScope.severity = this.panel.severity;
    newScope.source = source;
    newScope.theme = this.panel.theme;
    newScope.alarm = row.meta.alarm;
    newScope.ticketerConfig = row.meta.ticketerConfig;

    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<alarm-details-as-modal dismiss="dismiss()"></alarm-details-as-modal>',
      scope: newScope,
    });
  }

  performAlarmActionOnDatasource(source, action, alarmId) {
    let self = this;

    return new Promise((resolve, reject) => {
      this.datasourceSrv
        .get(source)
        .then((ds) => {
          if (ds.type && ds.type.indexOf('entity-datasource') < 0) {
            throw { message: 'Only OpenNMS datasources are supported' };
          } else {
            if (!ds[action]) {
              throw {
                message: 'Action ' + action + ' not implemented by datasource ' + ds.name + ' of type ' + ds.type,
              };
            }

            var actionPerfomed = ds[action](alarmId);
            actionPerfomed.then(
              (successObj) => {
                resolve(successObj);
              },
              (error) => {
                reject(error);
              }
            );
          }
        })
        .catch((err) => {
          self.error = err.message || 'Request Error';
          reject(err);
        });
    });
  }

  /* Refreshing Dashboard Panel */
  refreshDashboard() {
    this.timeSrv.refreshDashboard();
  }

  acknowledgeAlarm(source, alarmId) {
    return this.performAlarmActionOnDatasource(source, 'acknowledgeAlarm', alarmId);
  }

  unacknowledgeAlarm(source, alarmId) {
    return this.performAlarmActionOnDatasource(source, 'unacknowledgeAlarm', alarmId);
  }

  clearAlarm(source, alarmId) {
    return this.performAlarmActionOnDatasource(source, 'clearAlarm', alarmId);
  }

  escalateAlarm(source, alarmId) {
    return this.performAlarmActionOnDatasource(source, 'escalateAlarm', alarmId);
  }

  createTicketForAlarm(source, alarmId) {
    this.performAlarmActionOnDatasource(source, 'createTicketForAlarm', alarmId);
  }

  updateTicketForAlarm(source, alarmId) {
    this.performAlarmActionOnDatasource(source, 'updateTicketForAlarm', alarmId);
  }

  closeTicketForAlarm(source, alarmId) {
    this.performAlarmActionOnDatasource(source, 'closeTicketForAlarm', alarmId);
  }

  // Multi-select handling
  getRowsInRange(from, to) {
    let rows: any[] = [];
    if (!this.table) {
      return rows;
    }

    let findIdx = (selectionToMatch) => {
      if (this.table && this.table.meta && this.table.meta.entity_metadata) {
        return _.findIndex(this.table.meta.entity_metadata, (meta) => {
          return (
            (meta as any).source === selectionToMatch.source && (meta as any).alarm.id === selectionToMatch.alarmId
          );
        });
      }
      return -1;
    };

    let startIdx = findIdx(from);
    if (startIdx < 0) {
      return rows;
    }

    let endIdx = findIdx(to);
    if (endIdx < 0) {
      return rows;
    }

    if (endIdx < startIdx) {
      // Swap
      [startIdx, endIdx] = [endIdx, startIdx];
    }

    for (let i = startIdx; i <= endIdx; i++) {
      const meta = this.table.meta && this.table.meta.entity_metadata ? this.table.meta.entity_metadata[i] : {};
      rows.push({
        source: meta.source,
        alarmId: meta.alarm.id,
      });
    }
    return rows;
  }
}

export { AlarmTableCtrl };
