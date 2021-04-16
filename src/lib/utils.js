import _ from 'lodash';

export function assignModelProperties(target, source, defaults) {
  for (const key in defaults) {
    if (!defaults.hasOwnProperty(key)) {
      continue;
    }

    target[key] = source[key] === undefined ? defaults[key] : source[key];
  }
}

export function selectOptionsForCurrentValue(variable) {
  let i, y, value, option;
  const selected = [];

  for (i = 0; i < variable.options.length; i++) {
    option = variable.options[i];
    option.selected = false;
    if (_.isArray(variable.current.value)) {
      for (y = 0; y < variable.current.value.length; y++) {
        value = variable.current.value[y];
        if (option.value === value) {
          option.selected = true;
          selected.push(option);
        }
      }
    } else if (option.value === variable.current.value) {
      option.selected = true;
      selected.push(option);
    }
  }

  return selected;
}

export function setOptionAsCurrent(variable, option) {
  variable.current = _.cloneDeep(option || {});

  if (_.isArray(variable.current.text) && variable.current.text.length > 0) {
    variable.current.text = variable.current.text.join(' + ');
  } else if (_.isArray(variable.current.value) && variable.current.value[0] !== '$__all') {
    variable.current.text = variable.current.value.join(' + ');
  }

  selectOptionsForCurrentValue(variable);
  return variableUpdated(variable);
}

export function variableUpdated(variable, emitChangeEvents) {
  const $q = variable.$q;
  const dashboardSrv = variable.dashboardSrv;
  const templateSrv = variable.templateSrv;

  // if there is a variable lock ignore cascading update because we are in a boot up scenario
  if (variable.initLock) {
    return $q.when();
  }

  const getVariables = templateSrv.getVariables.bind(templateSrv) || dashboardSrv.dashboard.getVariables.bind(dashboardSrv.dashboard);
  const variables = getVariables();
  let promises = [];

  // in theory we should create an efficient sub-list of variables to update, but for now just do them all YOLO
  variables.forEach(v => promises.push(v.updateOptions()));

  templateSrv.setGlobalVariable(variable.id, variable.current);

  return $q.all(promises).then(() => {
    if (emitChangeEvents) {
      dashboardSrv.dashboard.templateVariableValueUpdated();
      dashboardSrv.dashboard.startRefresh();
    }
  });
}


export function setOptionFromUrl(variable, urlValue, $q) {
  let promise = $q.when();

  if (variable.refresh) {
    promise = variable.updateOptions();
  }

  return promise.then(() => {
    // Simple case. Value in url matches existing options text or value.
    let option = _.find(variable.options, op => {
      return op.text === urlValue || op.value === urlValue;
    });

    // No luck either it is array or value does not exist in the variables options.
    if (!option) {
      let defaultText = urlValue;
      const defaultValue = urlValue;

      if (_.isArray(urlValue)) {
        // Multiple values in the url. We construct text as a list of texts from all matched options.
        defaultText = urlValue.reduce((acc, item) => {
          const t = _.find(variable.options, { value: item });
          if (t) {
            acc.push(t.text);
          } else {
            acc.push(item);
          }

          return acc;
        }, []);
      }

      // It is possible that we did not match the value to any existing option. In that case the url value will be
      // used anyway for both text and value.
      option = { text: defaultText, value: defaultValue };
    }

    if (variable.multi) {
      // In case variable is multiple choice, we cast to array to preserve the same behaviour as when selecting
      // the option directly, which will return even single value in an array.
      option = { text: _.castArray(option.text), value: _.castArray(option.value) };
    }

    return variable.setValue(option);
  });
}

export function validateVariableSelectionState(variable, defaultValue) {
  if (!variable.current) {
    variable.current = {};
  }

  if (_.isArray(variable.current.value)) {
    let selected = selectOptionsForCurrentValue(variable);

    // if none pick first
    if (selected.length === 0) {
      selected = variable.options[0];
    } else {
      selected = {
        value: _.map(selected, val => {
          return val.value;
        }),
        text: _.map(selected, val => {
          return val.text;
        }),
      };
    }

    return variable.setValue(selected);
  } else {
    let option = undefined;

    // 1. find the current value
    option = _.find(variable.options, {
      text: variable.current.text,
    });
    if (option) {
      return variable.setValue(option);
    }

    // 2. find the default value
    if (defaultValue) {
      option = _.find(variable.options, {
        text: defaultValue,
      });
      if (option) {
        return variable.setValue(option);
      }
    }

    // 3. use the first value
    if (variable.options) {
      return variable.setValue(variable.options[0]);
    }

    // 4... give up
    return Promise.resolve();
  }
}

export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^}]+))?(?::(\w+))?}/g;

export const variableRegexExec = (variableString) => {
  variableRegex.lastIndex = 0;
  return variableRegex.exec(variableString);
};

export function containsVariable(...args) {
  const variableName = args[args.length - 1];
  args[0] = _.isString(args[0]) ? args[0] : Object['values'](args[0]).join(' ');
  const variableString = args.slice(0, -1).join(' ');
  const matches = variableString.match(variableRegex);
  const isMatchingVariable =
    matches !== null
      ? matches.find(match => {
          const varMatch = variableRegexExec(match);
          return varMatch !== null && varMatch.indexOf(variableName) > -1;
        })
      : false;

  return !!isMatchingVariable;
}

