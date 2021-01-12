export enum Types {
  ClassDeclaration = 'ClassDeclaration',
  Component = 'Component',
  AssignmentExpression = 'AssignmentExpression',
  ThisExpression = 'ThisExpression',
  VariableDeclaration = 'VariableDeclaration',
  ExpressionStatement = 'ExpressionStatement',
  ImportDeclaration = 'ImportDeclaration',
  ExportDefaultDeclaration = 'ExportDefaultDeclaration',
  ExportNamedDeclaration = 'ExportNamedDeclaration'
}

export enum ComponentLifecycleTypes {
  // DeprecatedLifecycle
  componentWillMount = 'componentWillMount',
  UNSAFE_componentWillMount = 'UNSAFE_componentWillMount',
  componentWillReceiveProps = 'componentWillReceiveProps',
  UNSAFE_componentWillReceiveProps = 'UNSAFE_componentWillReceiveProps',
  componentWillUpdate = 'componentWillUpdate',
  UNSAFE_componentWillUpdate = 'UNSAFE_componentWillUpdate',
  // NewLifecycle
  getSnapshotBeforeUpdate = 'getSnapshotBeforeUpdate',
  componentDidUpdate = 'componentDidUpdate',
  // StaticLifecycle
  getDerivedStateFromProps = 'getDerivedStateFromProps',
  getDerivedStateFromError = 'getDerivedStateFromError',
  // ComponentLifecycle
  componentDidMount = 'componentDidMount',
  shouldComponentUpdate = 'shouldComponentUpdate',
  componentWillUnmount = 'componentWillUnmount',
  componentDidCatch = 'componentDidCatch',
  // others
  render = 'render',
  constructor = 'constructor',
  getInitialState = 'getInitialState',
  getDefaultProps = 'getDefaultProps'
}