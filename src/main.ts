import recast from 'recast'
import fs from 'fs'
import { 
  originalCode,
  reactFunctionComponentDeclaration,
  transformState,
  setStateAction,
  useEffectExpressionStatement,
  useStateExpressionStatement,
  JSXReturnExpressionStatement,
  createImportSpecifier
} from './utils'
import { ComponentLifecycleTypes, Types } from './types'

const cwd = process.cwd() + '/'

const NotSupportComponentLifecycle = [
  ComponentLifecycleTypes.componentWillReceiveProps,
  ComponentLifecycleTypes.UNSAFE_componentWillReceiveProps,
  ComponentLifecycleTypes.componentWillUpdate,
  ComponentLifecycleTypes.UNSAFE_componentWillUpdate,
  ComponentLifecycleTypes.getSnapshotBeforeUpdate,
  ComponentLifecycleTypes.componentDidUpdate,
  ComponentLifecycleTypes.getDerivedStateFromProps,
  ComponentLifecycleTypes.getDerivedStateFromError,
  ComponentLifecycleTypes.shouldComponentUpdate,
  ComponentLifecycleTypes.componentDidCatch,
  ComponentLifecycleTypes.getDefaultProps,
  ComponentLifecycleTypes.getInitialState
]

const dealConstructor = (constructorBody, acc) => {
  constructorBody.forEach(constructorItem => {
    // 找到 this.state 
    const { expression } = constructorItem
    if(expression 
      && expression.type === Types.AssignmentExpression 
      && expression.operator === '=' 
      && expression.left.object.type === Types.ThisExpression
      && expression.left.property.name === 'state') {
        const stateRights = expression.right.properties
        stateRights.forEach(stateRight => {
            acc.state.push(useStateExpressionStatement({
              stateName: stateRight.key.name,
              setStateName: setStateAction(stateRight.key.name),
              defaultValue: originalCode(stateRight.value)
            }))
        })
    }
  });
}

const reactClassComponentToFunctionComponent  = ()=> {
  const code =  fs.readFileSync(cwd + 'src/description.js', {encoding:'utf8'}).toString()
  const initializer = recast.parse(code)
  const specifierInfo = {
    useState: false,
    useEffect: false
  }
  // 遍历文件当前页面第一层级结构
  const res = initializer.program.body.reduce((accumulate, item) => {
    if(item.type === Types.ClassDeclaration && item.superClass.name === Types.Component) {
      // 获取 react class component body 结构
      const reactClassComponentBody = item.body.body
      
      // 不支持的生命周期，暂且不管
      if(reactClassComponentBody.some(i => NotSupportComponentLifecycle.includes(i.key.name))) {
        accumulate.push(item)
      } else {
        const reactFCBody = reactClassComponentBody.reduce((acc, i)=> {
          if(i.key.name === ComponentLifecycleTypes.constructor) {
            const constructorBody = i.value.body.body
            // 只校验 存在 super(props) 和 this.state = { name: 'xiaoming' } 这种情况
            if(constructorBody.every(constructorItem=> constructorItem.type === Types.ExpressionStatement)) {
              specifierInfo.useState = true
              dealConstructor(constructorBody, acc)
            } else {
              accumulate.push(item)
            }
          } else if(i.key.name === ComponentLifecycleTypes.componentDidMount 
            || i.key.name === ComponentLifecycleTypes.UNSAFE_componentWillMount 
            || i.key.name === ComponentLifecycleTypes.componentWillMount) {
            specifierInfo.useEffect = true
            acc.componentDidMount = transformState(i.value.body)
          } else if(i.key.name === ComponentLifecycleTypes.componentWillUnmount) {
            specifierInfo.useEffect = true
            acc.componentWillUnmount = transformState(i.value.body)
          } else if(i.key.name === ComponentLifecycleTypes.render) {
            acc.return = transformState(i.value.body)
          } else {
            acc.methods.push(reactFunctionComponentDeclaration(i.key.name, {
              props: i.value.params.map(param=> param.name),
              content: i.value.body.body
            }))
          }
          return acc
        }, {
          state: [],
          methods: [],
          componentDidMount: [],
          componentWillUnmount: [],
          return: null
        })
        const rfc = reactFunctionComponentDeclaration(item.id.name, {
          props: ['props'],
          content: [
            ...reactFCBody.state,
            ...reactFCBody.methods,
            useEffectExpressionStatement({
              content: reactFCBody.componentDidMount,
              returnContent: reactFCBody.componentWillUnmount
            }),
            JSXReturnExpressionStatement(reactFCBody.return)
          ]
        })
        accumulate.push(rfc)
      }
    } else {
      accumulate.push(item)
    }
    return accumulate
  }, [])

  res.forEach(item => {
    if(item.type === Types.ImportDeclaration && item.source.value === 'react') {
      Object.entries(specifierInfo).forEach(([key, value])=> {
        if(value) item.specifiers.push(createImportSpecifier(key))
      })
    }
  })

  initializer.program.body = res
  console.log(recast.print(initializer).code)
}

export { reactClassComponentToFunctionComponent }