import _ from 'lodash';
import {ClientDelegate} from 'src/lib/client_delegate';
import {processSelectionVariables} from "src/lib/utils2";
import {dscpLabel, dscpSelectOptions} from "src/lib/tos_helper";
import kbn from 'app/core/utils/kbn';

export function intervalToMs(arg) {
  const func = kbn.intervalToMs || kbn.interval_to_ms;
  return func(arg);
}

export class FlowDatasource {
  /** @ngInject */
  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.client = new ClientDelegate(instanceSettings, backendSrv, $q);
  }

  query(options) {
    let start = options.range.from.valueOf();
    let end = options.range.to.valueOf();

    if (options.targets.length > 1) {
      throw new Error("Multiple targets are not currently supported when using the OpenNMS Flow Datasource.");
    }

    // Grab the first target
    let target = options.targets[0];
    if (target.metric === undefined || target.metric === null) {
      // Nothing to query - this can happen when we initially create the panel
      // and have not yet selected a metric
      return this.q.when({'data': []});
    }

    // Combine
    let N = this.getFunctionParameterOrDefault(target, 'topN', 0, 10);
    let includeOther = FlowDatasource.isFunctionPresent(target, 'includeOther');
    // Filter
    let exporterNode = this.getFunctionParameterOrDefault(target, 'withExporterNode', 0);
    let ifIndex = this.getFunctionParameterOrDefault(target, 'withIfIndex', 0);
    let dscp = processSelectionVariables(this.getFunctionParametersOrDefault(target, 'withDscp', 0, null));
    let applications = this.getFunctionParametersOrDefault(target, 'withApplication', 0, null);
    let conversations = this.getFunctionParametersOrDefault(target, 'withConversation', 0, null);
    let hosts = this.getFunctionParametersOrDefault(target, 'withHost', 0, null);
    // Transform
    let asTableSummary = FlowDatasource.isFunctionPresent(target, 'asTableSummary');

    // If a group by interval has been set we will use that to determine the step value, otherwise we will use the step
    // value from Grafana's automatically calculated maxDataPoints (based on pixel width)
    let groupByInterval = this.getFunctionParameterOrDefault(target, 'withGroupByInterval', 0, null);
    let step;
    if (groupByInterval) {
      step = intervalToMs(groupByInterval);
    } else {
      step = Math.floor((end - start) / options.maxDataPoints);
    }

    switch (target.metric) {
      case 'conversations':
        if (!asTableSummary) {
          if (conversations && conversations.length > 0) {
            return this.client.getSeriesForConversations(conversations, start, end, step, includeOther, exporterNode, ifIndex, dscp).then(series => {
              return {
                data: FlowDatasource.toSeries(target, series)
              };
            });
          } else {
            return this.client.getSeriesForTopNConversations(N, start, end, step, includeOther, exporterNode, ifIndex, dscp).then(series => {
              return {
                data: FlowDatasource.toSeries(target, series)
              };
            });
          }
        } else {
          if (conversations && conversations.length > 0) {
            return this.client.getSummaryForConversations(conversations, start, end, includeOther, exporterNode, ifIndex, dscp).then(table => {
              return {
                data: FlowDatasource.toTable(target, table)
              };
            });
          } else {
            return this.client.getSummaryForTopNConversations(N, start, end, includeOther, exporterNode, ifIndex, dscp).then(table => {
              return {
                data: FlowDatasource.toTable(target, table)
              };
            });
          }
        }
      case 'applications':
        if (!asTableSummary) {
          if (applications && applications.length > 0) {
            return this.client.getSeriesForApplications(applications, start, end, step, includeOther, exporterNode, ifIndex, dscp).then(series => {
              return {
                data: FlowDatasource.toSeries(target, series)
              };
            });
          } else {
            return this.client.getSeriesForTopNApplications(N, start, end, step, includeOther, exporterNode, ifIndex, dscp).then(series => {
              return {
                data: FlowDatasource.toSeries(target, series)
              };
            });
          }
        } else {
          if (applications && applications.length > 0) {
            return this.client.getSummaryForApplications(applications, start, end, includeOther, exporterNode, ifIndex, dscp).then(table => {
              return {
                data: FlowDatasource.toTable(target, table)
              };
            });
          } else {
            return this.client.getSummaryForTopNApplications(N, start, end, includeOther, exporterNode, ifIndex, dscp).then(table => {
              return {
                data: FlowDatasource.toTable(target, table)
              };
            });
          }
        }
      case 'hosts':
        if (!asTableSummary) {
          if (hosts && hosts.length > 0) {
            return this.client.getSeriesForHosts(hosts, start, end, step, includeOther, exporterNode, ifIndex, dscp).then(series => {
              return {
                data: FlowDatasource.toSeries(target, series)
              };
            });
          } else {
            return this.client.getSeriesForTopNHosts(N, start, end, step, includeOther, exporterNode, ifIndex, dscp).then(series => {
              return {
                data: FlowDatasource.toSeries(target, series)
              };
            });
          }
        } else {
          if (hosts && hosts.length > 0) {
            return this.client.getSummaryForHosts(hosts, start, end, includeOther, exporterNode, ifIndex, dscp).then(table => {
              return {
                data: FlowDatasource.toTable(target, table)
              };
            });
          } else {
            return this.client.getSummaryForTopNHosts(N, start, end, includeOther, exporterNode, ifIndex, dscp).then(table => {
              return {
                data: FlowDatasource.toTable(target, table)
              };
            });
          }
        }
      case 'dscps':
        if (!asTableSummary) {
          return this.client.getSeriesForDscps(start, end, step, exporterNode, ifIndex, dscp).then(series => {
            return {
              data: FlowDatasource.toSeries(target, series, dscpLabel)
            };
          });
        } else {
          return this.client.getSummaryForDscps(start, end, exporterNode, ifIndex, dscp).then(table => {
            return {
              data: FlowDatasource.toTable(target, table, dscpLabel)
            };
          });
        }
      default:
        throw 'Unsupported target metric: ' + target.metric;
    }
  }

  testDatasource() {
    return this.client.getClientWithMetadata()
      .then(metadata => {
        if (metadata) {
          return {
            status: "success",
            message: "Data source is working",
            title: "Success"
          };
        } else {
          return {
            status: "danger",
            message: "OpenNMS provided a response, but no metadata was found.",
            title: "Unexpected Response"
          }
        }
      }).catch(e => {
        if (e.message === "Unsupported Version") {
          return {
            status: "danger",
            message: "The OpenNMS version you are trying to connect to is not supported. " +
            "OpenNMS Horizon version >= 22.0.0 or OpenNMS Meridian version >= 2018.1.0 is required.",
            title: e.message
          }
        } else {
          throw e;
        }
      });
  }

  annotationQuery(/* options */) {
    return this.q.when([]);
  }

  // Used by template queries
  metricFindQuery(query) {
    if (query === null || query === undefined || query === "") {
      return this.$q.resolve([]);
    }
    query = this.templateSrv.replace(query);

    let exporterNodesRegex = /exporterNodesWithFlows\((.*)\)/;
    let interfacesOnExporterNodeRegex = /interfacesOnExporterNodeWithFlows\(\s*([^,]+).*\)/; // just pick the first arg and ignore anything else
    let dscpOnExporterNodeAndInterfaceRegex = /dscpOnExporterNodeAndInterface\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^\s]+\s*)\)/;

    let exporterNodesQuery = query.match(exporterNodesRegex);
    if (exporterNodesQuery) {
      return this.metricFindExporterNodes();
    }

    let interfacesOnExporterNodeQuery = query.match(interfacesOnExporterNodeRegex);
    if (interfacesOnExporterNodeQuery) {
      return this.metricFindInterfacesOnExporterNode(interfacesOnExporterNodeQuery[1]);
    }

    let dscpOnExporterNodeAndInterfaceQuery = query.match(dscpOnExporterNodeAndInterfaceRegex);
    if (dscpOnExporterNodeAndInterfaceQuery) {
      return this.metricFindDscpOnExporterNodeAndInterface(
          dscpOnExporterNodeAndInterfaceQuery[1], // node
          dscpOnExporterNodeAndInterfaceQuery[2], // interface
          dscpOnExporterNodeAndInterfaceQuery[3], // start millis
          dscpOnExporterNodeAndInterfaceQuery[4], // end millis
      );
    }

    return this.$q.resolve([]);
  }

  metricFindExporterNodes(/* query */) {
    return this.client.getExporters().then(exporters => {
      let results = [];
      _.each(exporters, function (exporter) {
        results.push({text: exporter.label, value: exporter.id, expandable: true});
      });
      return results;
    });
  }

  metricFindInterfacesOnExporterNode(query) {
    return this.client.getExporter(query).then(exporter => {
      let results = [];
      _.each(exporter.interfaces, function (iff) {
        results.push({text: iff.name + "(" + iff.index + ")", value: iff.index, expandable: true});
      });
      return results;
    });
  }

  metricFindDscpOnExporterNodeAndInterface(node, iface, start, end) {
    return this.client.getDscpValues(node,  iface, start, end).then(
        values => dscpSelectOptions(values)
    );
  }

  static toTable(
      target,
      table,
      labelTransformer
  ) {
    let toBits = FlowDatasource.isFunctionPresent(target, 'toBits');

    if (toBits) {
      let inIndex = table.headers.indexOf('Bytes In');
      let outIndex = table.headers.indexOf('Bytes Out');
      table.rows = _.map(table.rows, (row) => {
        row[inIndex] *= 8;
        row[outIndex] *= 8;
        return row;
      });
      table.headers[inIndex] = 'Bits In';
      table.headers[outIndex] = 'Bits Out';
    }

    if (labelTransformer) {
      table.rows.forEach(r => r[0] = labelTransformer(r[0]));
    }

    let ecnIndex = table.headers.lastIndexOf('ECN');
    if (ecnIndex > 0) {
      table.rows = _.map(table.rows, (row) => {
        let label;
        switch(row[ecnIndex]) {
          // all flows used ecn capable transports / no congestions were reported
          case 0: label = 'ect / no ce'; break;
          // at least some flows used non-ecn-capable transports / no congestions were reported
          case 1: label = 'non-ect / no ce'; break;
          // all flows used ecn capable transports / congestions were reported
          case 2: label = 'ect / ce'; break;
          // at least some flows used non-ecn-capable transports / congestions were reported
          case 3: label = 'non-ect / ce'; break;
        }
        if (label) {
          row[ecnIndex] = label;
        }
        return row;
      });
    }

    let columns = table && table.headers ? _.map(table.headers, column => {
      return {"text": column}
    }) : [];

    return [
      {
        "columns": columns,
        "rows": table.rows,
        "type": "table",
        "meta": {
          metric: target.metric,
          toBits: toBits
        }
      }
    ];
  }

  static toSeries(
      target,
      flowSeries,
      labelTransformer,
  ) {
    labelTransformer = labelTransformer ? labelTransformer : function(any) { return any; };
    let toBits = FlowDatasource.isFunctionPresent(target, 'toBits');
    let perSecond = FlowDatasource.isFunctionPresent(target, 'perSecond');
    let negativeEgress = FlowDatasource.isFunctionPresent(target, 'negativeEgress');
    let negativeIngress = FlowDatasource.isFunctionPresent(target, 'negativeIngress');
    let combineIngressEgress = FlowDatasource.isFunctionPresent(target, 'combineIngressEgress');
    let onlyIngress = FlowDatasource.isFunctionPresent(target, 'onlyIngress');
    let onlyEgress = FlowDatasource.isFunctionPresent(target, 'onlyEgress');

    let start = flowSeries.start.valueOf();
    let end = flowSeries.end.valueOf();
    let columns = flowSeries.columns;
    let values = flowSeries.values;
    let timestamps = flowSeries.timestamps;
    let series = [];
    let i, j, nRows, nCols, datapoints;

    let step = timestamps[1] - timestamps[0];

    if (timestamps !== undefined) {
      nRows = timestamps.length;
      nCols = columns.length;

      for (i = 0; i < nCols; i++) {
        // Optionally skip egress or ingress columns
        if (onlyIngress && !columns[i].ingress) {
          continue;
        }
        if (onlyEgress && columns[i].ingress) {
          continue;
        }

        let multiplier = negativeIngress ? -1 : 1;
        let suffix = " (In)";
        if (!columns[i].ingress) {
          multiplier = negativeEgress ? -1 : 1;
          suffix = " (Out)";
        }
        if (combineIngressEgress) {
          // Remove any suffix, so that ingress and egress both have the same label
          suffix = "";
        }
        if (perSecond) {
          multiplier /= step / 1000;
        }
        if (toBits) {
          // Convert from bytes to bits
          multiplier *= 8;
        }

        datapoints = [];
        for (j = 0; j < nRows; j++) {
          // Skip rows that are out-of-range
          if (timestamps[j] < start || timestamps[j] > end) {
            continue;
          }

          if (values[i][j] === 'NaN') {
            values[i][j] = null;
          }

          datapoints.push([values[i][j] * multiplier, timestamps[j]]);
        }

        series.push({
          target: labelTransformer(columns[i].label) + suffix,
          datapoints: datapoints
        });
      }
    }

    if (combineIngressEgress) {
      series = FlowDatasource.sumMatchingTargets(series);
    }

    return series;
  }

  static sumMatchingTargets(series) {
    let targetsByName = _.groupBy(series, (s) => s.target);
    let newSeries = [];
    _.each(targetsByName, (t) => {
      let target = t[0].target;
      let K = t.length;
      let N = t[0].datapoints.length;
      let summedDatapoints = new Array(N);
      for (let k = 0; k < K; k++) {
        let targetDatapoints = t[k].datapoints;
        for (let n = 0; n < N; n++) {
          if (summedDatapoints[n] == null) {
            summedDatapoints[n] = [0, targetDatapoints[n][1]];
          }
          let valueToAdd = targetDatapoints[n][0] == null ? 0 : targetDatapoints[n][0];
          summedDatapoints[n][0] = summedDatapoints[n][0] + valueToAdd;
        }
      }
      newSeries.push({
        target: target,
        datapoints: summedDatapoints
      })
    });
    return newSeries;
  }

  static getFirstFunction(target, name) {
    let matchingFunctions = _.filter(target.functions, function (f) {
      return f.name === name;
    });
    return matchingFunctions.length > 0 ? matchingFunctions[0] : null;
  }

  static getFunctions(target, name) {
    let matchingFunctions = _.filter(target.functions, function (f) {
      return f.name === name;
    });
    return matchingFunctions.length > 0 ? matchingFunctions : null;
  }

  static isFunctionPresent(target, name) {
    return FlowDatasource.getFirstFunction(target, name) !== null;
  }

  getFunctionParameterOrDefault(target, name, idx, def) {
    let func = FlowDatasource.getFirstFunction(target, name);
    if (func === null) {
      // No match, use the default value
      return def;
    }

    // Return the parameter value, and perform any required template variable substitutions
    if (_.isString(func.parameters[idx])) {
      return this.templateSrv.replace(func.parameters[idx]);
    } else {
      return func.parameters[idx];
    }
  }

  getFunctionParametersOrDefault(target, name, idx, def) {
    let funcs = FlowDatasource.getFunctions(target, name);
    if (funcs === null) {
      // No match, use the default value
      return def;
    }

    let returnFuncs = [];
    funcs.forEach((func) => {
      if (func.parameters[idx]) {
        returnFuncs.push(this.templateSrv.replace(func.parameters[idx]));
      }
    });

    // Return the parameter value, and perform any required template variable substitutions
    return returnFuncs;
  }
}
