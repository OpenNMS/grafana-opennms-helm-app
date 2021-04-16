import { TextBoxVariable } from './text_box_variable';
import { QueryVariable } from './query_variable';

const randomString = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');
  const length = 20;

  let str = '';
  for (let i = 0; i < length; i++) {
      str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
}

export class FilterColumn {
  constructor(text, label, datasource, resource, inputType, entityType, id, selected) {
    this.id = id || randomString();
    this._text = text;
    this.label = label;

    this.datasource = datasource;
    this.resource = resource;
    this.inputType = inputType || 'multi';
    this.entityType = entityType;
    this.selected = selected || {};
  }

  get text() {
    return (this.label === undefined || this.label.trim().length === 0) ? this._text : this.label;
  }

  set text(text) {
    this._text = text;
  }

  toModel($injector, filterState) {
    const model = Object.assign({}, this);
    model.type = this.inputType === 'text' ? 'textbox' : 'query';
    model.multi = this.inputType === 'multi' || this.inputType === undefined;

    console.debug('model=', model);
    let ret = undefined;
    if (model.type === 'textbox') {
      ret = $injector.instantiate(TextBoxVariable, { model: model, filterColumn: this, filterState: filterState });
    } else if (model.type === 'query') {
      ret = $injector.instantiate(QueryVariable, { model: model, filterColumn: this, filterState: filterState });
    }

    return ret;
  }

  toJSON() {
    return {
      id: this.id,
      text: this._text,
      label: this.label,
      datasource: this.datasource,
      resource: this.resource,
      inputType: this.inputType,
      entityType: this.entityType,
      selected: this.selected,
    };
  }

  static fromJSON(col) {
    return new FilterColumn(col.text, col.label, col.datasource, col.resource, col.inputType, col.entityType, col.id, col.selected);
  }
}
