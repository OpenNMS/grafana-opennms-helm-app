import { assignModelProperties, setOptionAsCurrent, setOptionFromUrl } from './utils';

export class TextBoxVariable {
  /** @ngInject **/
  constructor(model, filterColumn, filterState, $q, dashboardSrv, datasourceSrv, templateSrv) {
    this.defaults = {
      type: 'textbox',
      name: '',
      label: '',
      hide: 0, // VariableHide.dontHide
      query: '',
      current: {}, // as VariableOption
      options: [],
      skipUrlSync: false,
    }

    this.$q = $q;
    this.dashboardSrv = dashboardSrv;
    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.filterColumn = filterColumn;
    this.filterState = filterState;

    assignModelProperties(this, model, this.defaults);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option) {
    setOptionAsCurrent(this, option);
  }

  updateOptions() {
    this.options = [{ text: this.query.trim(), value: this.query.trim(), selected: false }];
    this.current = this.options[0];
    return Promise.resolve();
  }

  dependsOn() {
    return false;
  }

  setValueFromUrl(urlValue) {
    this.query = urlValue;
    return setOptionFromUrl(this, urlValue, this.$q);
  }

  getValueForUrl() {
    return this.current.value;
  }
}
