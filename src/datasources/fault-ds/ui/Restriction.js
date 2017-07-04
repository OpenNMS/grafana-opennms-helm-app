import _ from 'lodash';

export class Restriction {
    constructor(uiSegmentSrv, restriction) {
        this.uiSegmentSrv = uiSegmentSrv;
        this.segments = [];
        if (restriction) {
            this.setAttribute(restriction.attribute);
            this.setComparator(restriction.comparator);
            this.setValue(restriction.value);
        }
    }

    getSegmentCount() {
        return this.segments.length;
    }

    removeLastSegment() {
        this.segments.pop();
    }

    addSegment(segment) {
        if (segment) {
            this.segments.push(segment);
        }
    }

    setAttribute(attribute) {
        if (this.segments.length == 0) {
            this.segments.push({});
        }
        this.segments[0] = this.uiSegmentSrv.newKey(attribute);
    }

    setComparator(comparator) {
        if (this.segments.length == 1) {
            this.segments.push({});
        }
        this.segments[1] = this.uiSegmentSrv.newOperator(comparator);
    }

    setValue(value) {
        if (this.segments.length == 2) {
            this.segments.push({});
        }
        this.segments[2] = this.uiSegmentSrv.newKeyValue(value);
    }

    asRestrictionDTO() {
        const segments = _.filter(this.segments, function(segment) {
            return segment.type !== 'plus-button' && (segment.fake === undefined || segment.fake === false)
        });
        if (segments.length > 0 && segments.length % 3 == 0) {
            var data = {};
            _.each(segments, (segment) => {
                if (segment.type === 'key') {
                    data.attribute = segment.value;
                } else if (segment.type === 'operator') {
                    data.comparator = segment.value;
                } else if (segment.type === 'value') {
                    data.value = segment.value;
                }
            });
            return new RestrictionDTO(data.attribute, data.comparator, data.value);
        }
        return null;
    }

    asString() {
        const getComparator = function(restriction) {
            if (restriction.value === 'null') {
                if (restriction.comparator === '=') {
                    return "is";
                }
                if (restriction.comparator === '!=') {
                    return "is not";
                }
            }
            return restriction.comparator;
        };

        const getValue = function(restriction) {
            if (restriction.value === 'null') {
                return 'null';
            }
            return "'" + restriction.value + "'";
        };

        const restriction = this.asRestrictionDTO();
        if (restriction !== null) {
            return restriction.attribute + " " + getComparator(restriction) + " " + getValue(restriction);
        }
        return null;
    }
}

// Just use for internal use
export class RestrictionDTO {
    constructor(attribute, comparator, value) {
        this.attribute = attribute;
        this.comparator = comparator;
        this.value = value;
    }
}