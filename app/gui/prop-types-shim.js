function shim() {}

shim.isRequired = shim

function getShim() {
  return shim
}

const ReactPropTypes = {
  array: shim,
  bool: shim,
  func: shim,
  number: shim,
  object: shim,
  string: shim,
  symbol: shim,

  any: shim,
  arrayOf: getShim,
  element: shim,
  instanceOf: getShim,
  node: shim,
  objectOf: getShim,
  oneOf: getShim,
  oneOfType: getShim,
  shape: getShim,
  exact: getShim
}

ReactPropTypes.checkPropTypes = shim
ReactPropTypes.PropTypes = ReactPropTypes

export default ReactPropTypes
