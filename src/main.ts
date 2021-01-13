import recast from 'recast'
import fs from 'fs'
import path from 'path'
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
  identifier,
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

const dealComponentBody = (item, transformInfo, filePath) => {
    // 不支持的生命周期，暂且不管
    if(item.body.body.some(i => NotSupportComponentLifecycle.includes(i.key.name))) {
      console.log(chalk.yellow(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: Unsupported life cycle' ))
      return item
    } else {
      try {
        const reactFCBody = item.body.body.reduce((acc, i)=> {
          if(i.key.name === ComponentLifecycleTypes.constructor) {
            const constructorBody = i.value.body.body
            // 只校验 存在 super(props) 和 this.state = { name: 'xiaoming' } 这种情况
            if(constructorBody.every(constructorItem => constructorItem.type === Types.ExpressionStatement)) {
              transformInfo.useState = true
              dealConstructor(constructorBody, acc)
            } else {
              transformInfo.canConstructorSupport = false
              console.log(chalk.yellow(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: constructor content not support' ))
              return item
            }
          } else if(i.key.name === ComponentLifecycleTypes.componentDidMount 
            || i.key.name === ComponentLifecycleTypes.UNSAFE_componentWillMount 
            || i.key.name === ComponentLifecycleTypes.componentWillMount) {
              transformInfo.useEffect = true
            acc.componentDidMount = transformState(i.value.body)
          } else if(i.key.name === ComponentLifecycleTypes.componentWillUnmount) {
            transformInfo.useEffect = true
            acc.componentWillUnmount = transformState(i.value.body)
          } else if(i.key.name === ComponentLifecycleTypes.render) {
            acc.return = transformState(i.value.body)
          } else {
            acc.methods.push(reactFunctionComponentDeclaration(i.key.name, {
              props: i.value.params.map(param=> param.name),
              content: transformState(i.value.body)
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
            ...(reactFCBody.state || []),
            ...(reactFCBody.methods || []),
            ...((reactFCBody.componentDidMount.length 
              || reactFCBody.componentWillUnmount.length) ? [useEffectExpressionStatement({
              content: reactFCBody.componentDidMount,
              returnContent: reactFCBody.componentWillUnmount
            })]: []),
            ...JSXReturnExpressionStatement(reactFCBody.return || [])
          ]
        })
        transformInfo.canTransform = true
        return rfc
      } catch (e) {
        console.log(chalk.red(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: ' + e.description))
        return item
      }
    }
}

const isReactComponent = item => item.type === Types.ClassDeclaration && item.superClass.name === Types.Component
const isExportDefaultDeclaration = item => item.type === Types.ExportDefaultDeclaration && isReactComponent(item.declaration)
const isExportNamedDeclaration = item => item.type === Types.ExportNamedDeclaration && isReactComponent(item.declaration)

const reactClassComponentToFunctionComponent  = filePath => {
  const code =  fs.readFileSync(filePath, {encoding:'utf8'}).toString()
  try {
    const initializer = recast.parse(code)
    const transformInfo = {
      useState: false,
      useEffect: false,
      canTransform: false,
      canConstructorSupport: true
    }
    // 遍历文件当前页面第一层级结构
    const res = initializer.program.body.reduce((accumulate, item) => {
      // export default class Demo extends Component
      if(isExportDefaultDeclaration(item)) {
        accumulate.push(dealComponentBody(item.declaration, transformInfo, filePath), exportDefaultDeclaration(identifier(item.declaration.id.name)))
      } else if(isExportNamedDeclaration(item)) {
        // export class Demo extends Component
        accumulate.push(exportNamedDeclaration(dealComponentBody(item.declaration, transformInfo, filePath)))
      } else if(isReactComponent(item)) {
        // class Demo extends Component
        accumulate.push(dealComponentBody(item, transformInfo, filePath))
      } else {
        accumulate.push(item)
      }
      return accumulate
    }, [])
  
    res.forEach(item => {
      if(item.type === Types.ImportDeclaration && item.source.value === 'react') {
        Object.entries(transformInfo).filter(([key])=> key !== 'canTransform' && key !== 'canConstructorSupport').forEach(([key, value])=> {
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
  
    if(transformInfo.canTransform && transformInfo.canConstructorSupport) {
      fs.writeFile(path.resolve(filePath), recast.print(initializer).code, {} ,function(err){
        if(err) console.log(err)
        console.log(chalk.green('🎉 🎉 🎉 ' + filePath.replace(cwd, '') + ' Successful transform!!!'))
      })
    }
  } catch (e) {
    console.log(chalk.red(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: ' + e.description))
  } 
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
      console.log(chalk.redBright('\n The format of the file may be damaged. If necessary, please use eslint to process it uniformly \n'))
    }) 
  })
}

export { cc2fc }