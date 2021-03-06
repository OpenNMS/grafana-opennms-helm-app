import coreModule from 'grafana/app/core/core_module';
import { PanelPlugin } from '@grafana/data';

import { AlarmTableCtrl } from './alarmTableCtrl';
import { alarmDetailsAsDirective } from './alarm_details';
import { memoEditorAsDirective } from './memo_editor';
import { contextMenuAsDirective } from './context_menu';

import { initializeCss } from 'lib/utils';

initializeCss();

// @ts-ignore
export const plugin = new PanelPlugin(null as unknown);
plugin.angularPanelCtrl = AlarmTableCtrl;
plugin.setNoPadding();

coreModule.directive('alarmDetailsAsModal', alarmDetailsAsDirective);
coreModule.directive('memoEditor', memoEditorAsDirective);
coreModule.directive('contextMenu', contextMenuAsDirective());

coreModule.directive('dynamicHeight', ($window: Window) => {
  // Used to dynamically size the alarm details modal window
  return {
    link: (scope: any, element: JQuery<HTMLElement> /*, attrs */) => {
      const doResize = () => {
        element.css('max-height', $window.innerHeight * 0.8 + 'px');
      };

      doResize();
      element.on('$destroy', () => {
        $window.removeEventListener('resize', doResize);
      });
      $window.addEventListener('resize', doResize);
    },
  };
});
