import recast from 'recast'
import fs from 'fs'
import chalk from 'chalk'
import { 
  originalCode,
  reactFunctionComponentDeclaration,
  transformState,
  setStateAction,
  useEffectExpressionStatement,
  useStateExpressionStatement,
  JSXReturnExpressionStatement,
  createImportSpecifier,
  isChangesNotStagedForCommit,
  getArgvs,
  traverseFile,
} from './utils'
const {
  exportDefaultDeclaration,
  exportNamedDeclaration,
} = recast.types.builders
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

const dealComponentBody = (item, specifierInfo) => {
    // 不支持的生命周期，暂且不管
    if(item.body.body.some(i => NotSupportComponentLifecycle.includes(i.key.name))) {
      console.log('不支持的生命周期')
      return item
    } else {
      const reactFCBody = item.body.body.reduce((acc, i)=> {
        if(i.key.name === ComponentLifecycleTypes.constructor) {
          const constructorBody = i.value.body.body
          // 只校验 存在 super(props) 和 this.state = { name: 'xiaoming' } 这种情况
          if(constructorBody.every(constructorItem=> constructorItem.type === Types.ExpressionStatement)) {
            specifierInfo.useState = true
            dealConstructor(constructorBody, acc)
          } else {
            return item
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
          ...((reactFCBody.componentDidMount.length 
            || reactFCBody.componentWillUnmount.length) ? [useEffectExpressionStatement({
            content: reactFCBody.componentDidMount,
            returnContent: reactFCBody.componentWillUnmount
          })]: []),
          ...JSXReturnExpressionStatement(reactFCBody.return)
        ]
      })
      return rfc
    }
}

const isReactComponent = item => item.type === Types.ClassDeclaration && item.superClass.name === Types.Component
const isExportDefaultDeclaration = item => item.type === Types.ExportDefaultDeclaration && isReactComponent(item.declaration)
const isExportNamedDeclaration = item => item.type === Types.ExportNamedDeclaration && isReactComponent(item.declaration)

const reactClassComponentToFunctionComponent  = path => {
  const code =  fs.readFileSync(path, {encoding:'utf8'}).toString()
  const initializer = recast.parse(code)
  const specifierInfo = {
    useState: false,
    useEffect: false
  }
  // 遍历文件当前页面第一层级结构
  const res = initializer.program.body.reduce((accumulate, item) => {
    // export default class Demo extends Component
    if(isExportDefaultDeclaration(item)) {
        accumulate.push(exportDefaultDeclaration(dealComponentBody(item.declaration, specifierInfo)))
    } else if(isExportNamedDeclaration(item)) {
       // export class Demo extends Component
        accumulate.push(exportNamedDeclaration(dealComponentBody(item.declaration, specifierInfo)))
    } else if(isReactComponent(item)) {
      // class Demo extends Component
      accumulate.push(dealComponentBody(item, specifierInfo))
    } else {
      console.log('不是React Class 组件')
      accumulate.push(item)
    }
    return accumulate
  }, [])

  res.forEach(item => {
    if(item.type === Types.ImportDeclaration && item.source.value === 'react') {
      Object.entries(specifierInfo).forEach(([key, value])=> {
        if(value) {
          item.specifiers.push(createImportSpecifier(key))
          // remove import React, { Component } from 'react' 中的 Component
          const ComponentIndex = item.specifiers.findIndex(i=> i.imported?.name === Types.Component)
          if(ComponentIndex !== -1) {
            item.specifiers.splice(ComponentIndex, 1)
          }
        }
      })
    }
  })

  initializer.program.body = res
  console.log(recast.print(initializer).code)
}

const cc2fc = () => {
  isChangesNotStagedForCommit().then(()=> {
    const argvs = getArgvs().map(item=> {
      if(item.substr(item.length -1) === '/') {
          return item.substr(0, item.length -1)
      }
      return item
    })

    if(argvs.length !== 1) {
      console.log(chalk.red('only supports commands react-cc2dc start filePath'))
      return
    }

    fs.stat(cwd + argvs[0], (err, data)=> {
      if(data.isFile()) {
        reactClassComponentToFunctionComponent(cwd + argvs[0])
      } else {
        traverseFile(cwd + argvs[0], path=> {
          reactClassComponentToFunctionComponent(path)
        })
      }
    }) 

  })
}

export { cc2fc }