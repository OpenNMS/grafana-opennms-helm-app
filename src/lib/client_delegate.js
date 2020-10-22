import {API, Client, Rest} from 'opennms';
import _ from 'lodash';

let Q;

export class ClientDelegate {
    /** @ngInject */
    constructor(settings, backendSrv, $q) {
        this.type = settings.type;
        this.url = settings.url;
        this.name = settings.name;
        this.backendSrv = backendSrv;
        this.searchLimit = 1000;
        this.$q = $q;
        if (!Q) {
            Q = $q;
        }

        if (settings.jsonData && settings.jsonData.timeout) {
            this.timeout = parseInt(settings.jsonData.timeout,10) * 1000;
        }

        let authConfig = undefined;
        if (settings.basicAuth) {
          // If basic auth is configured, pass the username and password to the client
          // This allows the datasource to work in direct mode
          // We need the raw username and password, so we decode the token
          const token = settings.basicAuth.split(' ')[1];
          const decodedToken = atob(token);
          const username = decodedToken.split(':')[0];
          const password = decodedToken.substring(username.length+1, decodedToken.length);
          authConfig = new API.OnmsAuthConfig(username, password);
        }

        const server = API.OnmsServer.newBuilder(this.url).setName(this.name).setAuth(authConfig).build();
        const http = new Rest.GrafanaHTTP(this.backendSrv, server, this.timeout);
        this.client = new Client(http);
        this.clientWithMetadata = undefined;
     }

    decorateError(err) {
        let ret = err;
        if (err.err) {
            ret = err.err;
        }
        if (err.data && err.data.err) {
            ret = err.data.err;
        }
        let statusText = 'Request failed.';

        // cancelled property causes the UI to never complete on failure
        if (err.cancelled) {
            statusText = 'Request timed out.';
            delete err.cancelled;
        }
        if (err.data && err.data.cancelled) {
            statusText = 'Request timed out.';
            delete err.data.cancelled;
        }

        if (!ret.message) {
            ret.message = ret.statusText || statusText;
        }
        if (!ret.status) {
            ret.status = 'error';
        }
        return Q.reject(ret);
    }

    getClientWithMetadata() {
        if (!this.clientWithMetadata) {
              const self = this;
              const http = self.client.http;
              const client = Client.getMetadata(http.server, http, self.timeout)
                .then(function(metadata) {
                    // Ensure the OpenNMS we are talking to is compatible
                    if (metadata.apiVersion() < 2) {
                        throw new Error("Unsupported Version");
                    }
                    const server = API.OnmsServer.newBuilder(http.server.url)
                        .setName(http.server.name)
                        .setAuth(http.server.auth)
                        .setMetadata(metadata)
                        .build();
                    http.server = server;
                    return self.client;
                }).catch(function(e) {
                    // in case of error, reset the client, otherwise
                    // the datasource may never recover
                    self.clientWithMetadata = void 0;
                    throw e;
                });

          // Grafana functions that invoke the datasource expect the
          // promise to be one that is returned by $q.
          const deferred = this.$q.defer();
          client.then((success) => deferred.resolve(success)).catch((error) => deferred.reject(error));
          this.clientWithMetadata = deferred.promise;
        }
        return this.clientWithMetadata;
    }

    // Inventory (node) related functions

    getNodeDao() {
        return this.getClientWithMetadata().then(function(client) {
            return client.nodes();
        });
    }

    findNodes(filter) {
        return this.getNodeDao()
            .then(function(nodeDao) {
                return nodeDao.find(filter);
            }).catch(this.decorateError);
    }

    getNode(nodeId) {
      return this.getNodeDao()
        .then(function(nodeDao) {
            return nodeDao.get(nodeId);
        }).catch(this.decorateError);
    }

    getNodeProperties() {
        return this.getNodeDao()
            .then(nodeDao => {
                return nodeDao.searchProperties();
            }).catch(this.decorateError);
    }

    findNodeProperty(propertyId) {
        return this.getNodeProperties()
            .then(properties => {
                return _.find(properties, function(property) {
                    return property.id === propertyId;
                });
            });
    }

    getNodePropertyComparators(propertyId) {
        return this.findNodeProperty(propertyId)
            .then(property => {
                if (property) {
                    const comparators = property.type.getComparators();
                    if (comparators && comparators.length > 0) {
                        return comparators;
                    }
                }
                console.log("No comparators found for property with id '" + propertyId + "'. Falling back to EQ.");
                // This may be the case when the user entered a property, which does not exist
                // therefore fallback to EQ
                return [ API.Comparators.EQ ];
            }).catch(this.decorateError);
    }

    // Fault related functions

    getAlarmDao() {
        return this.getClientWithMetadata().then(function(client) {
            return client.alarms();
        });
    }

    findAlarms(filter) {
        return this.getAlarmDao()
            .then(function(alarmDao) {
                return alarmDao.find(filter);
            }).catch(this.decorateError);
    }

    getAlarm(alarmId) {
      return this.getAlarmDao()
        .then(function(alarmDao) {
            return alarmDao.get(alarmId);
        }).catch(this.decorateError);
    }

    doEscalate(alarmId, user) {
        return this.getAlarmDao()
            .then(alarmDao => {
                return alarmDao.escalate(alarmId, user)
            }).catch(this.decorateError);
    }

    doClear(alarmId, user) {
        return this.getAlarmDao()
            .then(alarmDao => {
                return alarmDao.clear(alarmId, user);
            }).catch(this.decorateError);
    }

    doUnack(alarmId, user) {
        return this.getAlarmDao()
            .then(alarmDao => {
                return alarmDao.unacknowledge(alarmId, user);
            }).catch(this.decorateError);
    }

    doAck(alarmId, user) {
        return this.getAlarmDao()
            .then(function(alarmDao) {
                return alarmDao.acknowledge(alarmId, user);
            }).catch(this.decorateError);
    }

    doTicketAction(alarmId, action) {
        const supportedActions = ["create", "update", "close"];
        if (supportedActions.indexOf(action) < 0) {
            throw {message: "Action '" + action + "' not supported."};
        }
        const self = this;
        return this.backendSrv.datasourceRequest({
            url: self.url + '/api/v2/alarms/' + alarmId + "/ticket/" + action,
            method: 'POST',
        }).catch(this.decorateError);
    }

    saveSticky(alarmId, sticky, user) {
      return this.getAlarmDao()
        .then(function(alarmDao) {
          return alarmDao.saveStickyMemo(alarmId, sticky, user);
        }).catch(this.decorateError);
    }

    deleteSticky(alarmId) {
      return this.getAlarmDao()
        .then(function(alarmDao) {
          return alarmDao.deleteStickyMemo(alarmId);
        }).catch(this.decorateError);
    }

    saveJournal(alarmId, journal, user) {
      return this.getAlarmDao()
        .then(function(alarmDao) {
          return alarmDao.saveJournalMemo(alarmId, journal, user);
        }).catch(this.decorateError);
    }

    deleteJournal(alarmId) {
      return this.getAlarmDao()
        .then(function(alarmDao) {
          return alarmDao.deleteJournalMemo(alarmId);
        }).catch(this.decorateError);
    }

    findOperators() {
        const operators = _.map(API.Operators, function(operator) {
            return {
                id: operator.id,
                label: operator.label
            }
        });
        return this.$q.when(operators);
    }

    getAlarmProperties() {
        return this.getAlarmDao()
            .then(alarmDao => {
                return alarmDao.searchProperties();
            }).catch(this.decorateError);
    }

    findAlarmProperty(propertyId) {
        return this.getAlarmProperties()
            .then(properties => {
                return _.find(properties, function(property) {
                    return property.id === propertyId;
                });
            });
    }

    getAlarmPropertyComparators(propertyId) {
        return this.findAlarmProperty(propertyId)
            .then(property => {
                if (property) {
                    const comparators = property.type.getComparators();
                    if (comparators && comparators.length > 0) {
                        return comparators;
                    }
                }
                console.log("No comparators found for property with id '" + propertyId + "'. Falling back to EQ.");
                // This may be the case when the user entered a property, which does not exist
                // therefore fallback to EQ
                return [ API.Comparators.EQ ];
            }).catch(this.decorateError);
    }


    // Situation Feedback functions

    getSituationfeedbackDao() {
        return this.getClientWithMetadata().then(function (c) {
            return c.situationfeedback();
        }).catch(this.decorateError);
    }

    getSituationfeedback(situationId) {
        return this.getSituationfeedbackDao()
        .then(function(feedbackDao) {
            return feedbackDao.getFeedback(situationId);
        }).catch(this.decorateError);
    }

    submitSituationFeedback(situationId, feedback) {
        return this.getSituationfeedbackDao()
        .then(function(feedbackDao) {
          return feedbackDao.saveFeedback(feedback, situationId);
        }).catch(this.decorateError);
    }

    // Flow related functions

    getFlowDao() {
        return this.getClientWithMetadata().then(function(c) {
            return c.flows();
        }).catch(this.decorateError);
    }

    getApplications(prefix, start, end, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getApplications(prefix, start, end, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSeriesForTopNApplications(N, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSeriesForTopNApplications(N, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSeriesForApplications(applications, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSeriesForApplications(applications, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSummaryForTopNApplications(N, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSummaryForTopNApplications(N, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSummaryForApplications(applications, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSummaryForApplications(applications, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSeriesForTopNConversations(N, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSeriesForTopNConversations({
                    N: N,
                    start: start,
                    end: end,
                    step: step,
                    exporterNode: nodeCriteria,
                    ifIndex: interfaceId,
                    dscp: dscp,
                    ecn: ecn,
                    includeOther: includeOther
                });
            }).catch(this.decorateError);
    }

    getSeriesForConversations(conversations, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSeriesForConversations(conversations, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSummaryForTopNConversations(N, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSummaryForTopNConversations({
                    N: N,
                    start: start,
                    end: end,
                    exporterNode: nodeCriteria,
                    ifIndex: interfaceId,
                    dscp: dscp,
                    ecn: ecn,
                    includeOther: includeOther
                });
            }).catch(this.decorateError);
    }

    getSummaryForConversations(conversations, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSummaryForConversations(conversations, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getHosts(prefix, start, end, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getHosts(prefix + '.*', start, end, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSeriesForHosts(hosts, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSeriesForHosts(hosts, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSeriesForTopNHosts(N, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSeriesForTopNHosts(N, start, end, step, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSummaryForTopNHosts(N, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSummaryForTopNHosts(N, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getSummaryForHosts(hosts, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getSummaryForHosts(hosts, start, end, includeOther, nodeCriteria, interfaceId, dscp, ecn);
            }).catch(this.decorateError);
    }

    getExporters(start, end) {
        let searchLimit = this.searchLimit;
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getExporters(searchLimit, start, end);
            }).catch(this.decorateError);
    }

    getExporter(nodeCriteria, start, end) {
        let searchLimit = this.searchLimit;
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getExporter(nodeCriteria, searchLimit, start, end);
            }).catch(this.decorateError);
    }

    getDscpValues(nodeCriteria, interfaceId, start, end) {
        return this.getFlowDao()
            .then(function(flowDao) {
                return flowDao.getDscpValues(nodeCriteria, interfaceId, start, end);
            }).catch(this.decorateError);
    }

    getSummaryForDscps(start, end, nodeCriteria, interfaceId, dscp, ecn) {
      return this.getFlowDao()
          .then(function(flowDao) {
            return flowDao.getSummaryForDscps(start, end, nodeCriteria, interfaceId, dscp, ecn);
          }).catch(this.decorateError);
    }

    getSeriesForDscps(start, end, step, nodeCriteria, interfaceId, dscp, ecn) {
      return this.getFlowDao()
          .then(function(flowDao) {
            return flowDao.getSeriesForDscps(start, end, step, nodeCriteria, interfaceId, dscp, ecn);
          }).catch(this.decorateError);
    }

    getEcnValues(nodeCriteria, interfaceId, start, end) {
      return this.getFlowDao()
          .then(function(flowDao) {
            return flowDao.getEcnValues(nodeCriteria, interfaceId, start, end);
          }).catch(this.decorateError);
    }

    getSummaryForEcns(start, end, nodeCriteria, interfaceId, dscp, ecn) {
      return this.getFlowDao()
          .then(function(flowDao) {
            return flowDao.getSummaryForEcns(start, end, nodeCriteria, interfaceId, dscp, ecn);
          }).catch(this.decorateError);
    }

    getSeriesForEcns(start, end, step, nodeCriteria, interfaceId, dscp, ecn) {
      return this.getFlowDao()
          .then(function(flowDao) {
            return flowDao.getSeriesForEcns(start, end, step, nodeCriteria, interfaceId, dscp, ecn);
          }).catch(this.decorateError);
    }

}
