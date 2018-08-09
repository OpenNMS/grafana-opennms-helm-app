import { TableRenderer } from "./renderer"
import md5 from '../../crypto-js/md5';

export class AlarmDetailsCtrl {

  /** @ngInject */
  constructor($scope, backendSrv, contextSrv, $q) {
    this.$scope = $scope;
    this.backendSrv = backendSrv;
    this.contextSrv = contextSrv;
    this.editFeedback = false;
    $scope.editor = { index: 0 };

    // Save the alarm
    $scope.alarm = $scope.$parent.alarm;
    $scope.source = $scope.$parent.source;

    // Compute the icon
    let severity = $scope.alarm.severity.label.toLowerCase();
    $scope.severityIcon = TableRenderer.getIconForSeverity(severity);

    // Situation Feedback
    $scope.situationFeebackEnabled = false;

    // Compute the tabs
    $scope.tabs = ['Overview', 'Memos'];
    $scope.ticketingEnabled = $scope.$parent.ticketerConfig && $scope.$parent.ticketerConfig.enabled;
    if ($scope.ticketingEnabled) {
      $scope.tabs.push('Ticketing');
    }
    // If this is a Situation, collect any correlation feedback previously submitted
    if ($scope.alarm.relatedAlarms && $scope.alarm.relatedAlarms.length > 0) {
      $scope.tabs.push('Related Alarms');
      console.log($q);
      let request = this.doOpenNMSRequest({
        url: '/rest/situation-feedback/' + encodeURIComponent($scope.alarm.reductionKey),
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      let self = this;
      request
      .then(
        function (response) {
          console.log("Got response: ", response);
          if (response.data && response.data.length > 0) {
            $scope.situationFeedback = self.parseResponse(response.data);
            $scope.hasSituationFeedback = true;
          } else {
            $scope.situationFeedback = self.initalizeFeeback();
          }
          $scope.situationFeedbackOkayButton = self.situationFeedbackOkayButton();
          $scope.situationFeebackEnabled = true;
        })
        .catch(
          function (reason) {
            console.log("Got error: ", reason);
            $scope.situationFeedback = self.initalizeFeeback();
            $scope.situationFeedbackOkayButton = self.situationFeedbackOkayButton();
          });
    }

    // Raw global details link
    $scope.detailsLink = $scope.alarm.detailsPage.substring(0, $scope.alarm.detailsPage.indexOf("="));
  }

  detailFeedbackIncorrectButton(reductionKey) {
    let button = "/public/plugins/opennms-helm-app/img/thumbs-down";
    if (this.$scope.situationFeedback && this.$scope.hasSituationFeedback) {
      for (let feedback of this.$scope.situationFeedback) {
        if (feedback.alarmKey == reductionKey && feedback.feedbackType == "FALSE_POSITVE") {
          button += "-fill";
          break;
        }
      }
    }
    button += ".png";
    return button;
  }

  detailFeedbackOkayButton(reductionKey) {
    let button = "/public/plugins/opennms-helm-app/img/thumb-up-filled";
    if (this.$scope.situationFeedback) {
      for (let feedback of this.$scope.situationFeedback) {
        if (feedback.alarmKey == reductionKey && feedback.feedbackType == "FALSE_POSITVE") {
          button = "/public/plugins/opennms-helm-app/img/thumb-up";
          break;
        }
      }
    }
    button += ".png";
    return button;
  }

  initalizeFeeback() {
    let feedback = [];
    for (let alarm of this.$scope.alarm.relatedAlarms) {
      feedback.push(this.alarmFeedback(this.$scope.alarm.reductionKey, this.fingerPrint(this.$scope.alarm), alarm, "CORRECT", "ALL_CORRECT", this.contextSrv.user.login));
    }
    return feedback;
  }

  markIncorrect(reductionKey) {
    console.log("Negative Feedback for  " + reductionKey)
    for (let feedback of this.$scope.situationFeedback) {
      if (feedback.alarmKey == reductionKey) {
        feedback.feedbackType = "FALSE_POSITVE";
        console.log("Marked " + reductionKey + "as incorrect.")
        break;
      }
    }
  }

  markCorrect(reductionKey) {
    console.log("Positive Feedback for  " + reductionKey)
    for (let feedback of this.$scope.situationFeedback) {
      if (feedback.alarmKey == reductionKey) {
        feedback.feedbackType = "CORRECT";
        console.log("Marked " + reductionKey + "as correct.")
        break;
      }
    }
  }

  parseResponse(data) {
    let feedback = [];
    let fingerprint = this.fingerPrint(this.$scope.alarm);
    for (let fb of data) {
      if (fb.situationFingerprint == fingerprint) {
        feedback.push(fb);
      }
    }
    return feedback;
  }

  submitAllPositiveFeedback() {
    console.log("submit all positive Feedback");
    this.submitFeedback(this.$scope.situationFeedback);
  }

  submitEditedFeedback(form) {
    console.log("submit Edited Feedback: ", form.reason);
    for (let feedback of this.$scope.situationFeedback) {
      feedback.reason = form.reason;
    }
    this.submitFeedback(this.$scope.situationFeedback);
  }

  submitFeedback(feedback) {
    console.log("Submitting Feedback: ", feedback);
    let self = this;
    let request = this.doOpenNMSRequest({
      url: '/rest/situation-feedback/' + encodeURIComponent(this.$scope.alarm.reductionKey),
      data: feedback,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    request
      .then(
        function (response) {
          console.log("Got POST response: ", response);
          self.$scope.editFeedback = false;
          self.$scope.submittedFeedback = true;
          self.$scope.hasSituationFeedback = true;
        })
      .catch(
        function (reason) {
          console.log("Got POST error: ", reason);
          self.$scope.editFeedback = false;
        });
  }

  editSituationFeedback() {
    this.$scope.editFeedback = true;
    this.$scope.submittedFeedback = false;
  }

  situationFeedbackOkayButton() {
    let button = "/public/plugins/opennms-helm-app/img/thumb-up";
    let fingerprint = this.fingerPrint(this.$scope.alarm);
    if (this.$scope.situationFeedback) {
      for (let feedback of this.$scope.situationFeedback) {
        if (feedback.situationFingerprint == fingerprint && this.$scope.hasSituationFeedback) {
          button += "-filled";
          break;
        }
      }
    }
    button += ".png";
    return button;
  }

  cancelEditedFeedback() {
    this.$scope.situationFeedback = this.initalizeFeeback();
    this.$scope.editFeedback = false;
    this.$scope.submittedFeedback = false;
  }

  fingerPrint(situation) {
    return btoa(md5(situation.relatedAlarms));
  }

  alarmFeedback(situationKey, fingerprint, alarm, feedbackType, reason, user) {
    let feedback = {};
    feedback.situationKey = situationKey;
    feedback.situationFingerprint = fingerprint;
    feedback.alarmKey = alarm.reductionKey;
    feedback.feedbackType = feedbackType;
    feedback.reason = reason;
    feedback.user = user;
    return feedback;
  }

  doOpenNMSRequest(options) {
    options.withCredentials = true;
    options.headers = options.headers || {};
    options.headers.Authorization = 'Basic YWRtaW46YWRtaW4=';
    options.url = 'http://localhost:8980/opennms' + options.url;
    return this.backendSrv.datasourceRequest(options);
  };

}

/** @ngInject */
export function alarmDetailsAsDirective() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'public/plugins/opennms-helm-app/panels/alarm-table/alarm_details.html',
    controller: AlarmDetailsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dismiss: "&" }
  };
}
