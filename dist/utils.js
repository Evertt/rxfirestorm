import { transform, isEqualWith, isEqual, isObject } from "lodash";
function customizer(baseValue, value) {
    if (Array.isArray(baseValue) && Array.isArray(value)) {
        return isEqual(baseValue.sort(), value.sort());
    }
    if (baseValue && baseValue.firestore && value && value.firestore) {
        return baseValue.path === value.path;
    }
    return isEqual(baseValue, value);
}
export function difference(object, base) {
    function changes(object, base) {
        return transform(object, (result, value, key) => {
            if (!isEqualWith(value, base[key], customizer)) {
                result[key] = (isObject(value) && isObject(base[key])) ? changes(value, base[key]) : value;
            }
        }, {});
    }
    if (object.docRef) {
        object = Object.assign({}, object);
        delete object.docRef;
    }
    if (base.docRef) {
        base = Object.assign({}, base);
        delete base.docRef;
    }
    return changes(object, base);
}
//# sourceMappingURL=utils.js.map