import recast from 'recast'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { 
  reactFunctionComponentDeclaration,
  transformState,
  useEffectExpressionStatement,
  useStateExpressionStatement,
  JSXReturnExpressionStatement,
  createImportSpecifier,
  isChangesNotStagedForCommit,
  getArgvs,
  traverseFile,
  createUseStateFunctionArguments,
  recastBabel,
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

  const tempConstructorBody = [...constructorBody]
  const superIndex = tempConstructorBody.findIndex(constructorItem => {
    return constructorItem?.expression?.callee?.type === Types.Super
  })
  tempConstructorBody.splice(superIndex, 1)

  const states = []
  const ThisStateBodyIndex =  tempConstructorBody.findIndex(constructorItem => {
    return constructorItem?.expression?.left?.object?.type === Types.ThisExpression && constructorItem?.expression?.left?.property?.name === 'state'
  })
  const ThisStateBody = tempConstructorBody[ThisStateBodyIndex]
  tempConstructorBody.splice(ThisStateBodyIndex, 1)
  if(tempConstructorBody.length) {
    states.push(useStateExpressionStatement(createUseStateFunctionArguments(tempConstructorBody, ThisStateBody.expression.right)))
  } else {
    states.push(useStateExpressionStatement(ThisStateBody.expression.right))
  }
  acc.state.push(...states)
}

const dealComponentBody = (item, transformInfo, filePath) => {
    // 不支持除 ClassMethod 以外的属性存在
    if(item.body.body.some(i => i.type !== Types.ClassMethod)) {
      console.log(chalk.yellow('Warning: ' + filePath.replace(cwd, '') + ' Can\'t be converted! the reason: Class has attributes other than ClassMethod' ))
      return item
    } else if(item.body.body.some(i => NotSupportComponentLifecycle.includes(i.key.name))) {
      // 不支持的生命周期，暂且不管
      console.log(chalk.yellow('Warning: ' + filePath.replace(cwd, '') + ' Can\'t be converted! the reason: Unsupported life cycle' ))
      return item
    } else {
      try {
        const reactFCBody = item.body.body.reduce((acc, i, index)=> {
          if(i.key.name === ComponentLifecycleTypes.constructor) {
            const constructorBody = i.body.body
            // 不校验 同时存在 this.state = {} 和 this.otherProtype = '123' 的情况
            if(constructorBody.some(constructorItem => {
              const { expression } = constructorItem
              return expression && ((expression.type === Types.AssignmentExpression && expression?.left?.property?.name !== 'state') || (expression.type === Types.CallExpression && expression?.callee?.type === Types.MemberExpression))
            })) {
              transformInfo.canConstructorSupport = false
              console.log(chalk.yellow('Warning: ' + filePath.replace(cwd, '') + ' Can\'t be converted! the reason: constructor content not support' ))
              return item
            } else {
              transformInfo.useState = true
              dealConstructor(constructorBody, acc)
            }
          } else if(i.key.name === ComponentLifecycleTypes.componentDidMount 
            || i.key.name === ComponentLifecycleTypes.UNSAFE_componentWillMount 
            || i.key.name === ComponentLifecycleTypes.componentWillMount) {
              transformInfo.useEffect = true
            acc.componentDidMount = transformState(i.body)
          } else if(i.key.name === ComponentLifecycleTypes.componentWillUnmount) {
            transformInfo.useEffect = true
            acc.componentWillUnmount = transformState(i.body)
          } else if(i.key.name === ComponentLifecycleTypes.render) {
            acc.return = transformState(i.body)
          } else {
            ;(acc.methods || []).push(reactFunctionComponentDeclaration(i.key.name, {
              props: i.params,
              content: transformState(i.body)
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
          props: [identifier('props')],
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
        console.log(chalk.red('Error: ' + filePath.replace(cwd, '') + ' Can\'t be converted! the reason: ' + e.message))
        return item
      }
    }
}

const isReactComponent = item => item?.type === Types.ClassDeclaration && item?.superClass?.name === Types.Component
const isExportDefaultDeclaration = item => item.type === Types.ExportDefaultDeclaration && isReactComponent(item.declaration)
const isExportNamedDeclaration = item => item.type === Types.ExportNamedDeclaration && isReactComponent(item.declaration)

const reactClassComponentToFunctionComponent  = filePath => {
  const code =  fs.readFileSync(filePath, {encoding:'utf8'}).toString()
  try {
    const initializer = recastBabel.parse(code)
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
          }
        })
        if(Object.entries(transformInfo).some(([key, value])=> key === 'canTransform' && value)) {
           // remove import React, { Component } from 'react' 中的 Component
           const ComponentIndex = item.specifiers.findIndex(i=> i.imported?.name === Types.Component)
           if(ComponentIndex !== -1) {
             item.specifiers.splice(ComponentIndex, 1)
           }
        } 
      }
    })
  
    initializer.program.body = res
    if(transformInfo.canTransform && transformInfo.canConstructorSupport) {
      try { 
        fs.writeFileSync(path.resolve(filePath), recastBabel.print(initializer),{})
        // console.log(recastBabel.print(initializer))
        console.log(chalk.green('Success: 🎉 🎉 🎉 ' + filePath.replace(cwd, '') + ' Successful transform!!!'))
      } catch(err) { 
        console.error(err); 
      }
    }
  } catch (e) {
    console.log(chalk.red('Error: pasrse Error!!! ' + filePath.replace(cwd, '') + ' Can\'t be converted! the reason: ' + e.description))
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
      console.log(chalk.red('Error: only supports commands react-cc2dc start filePath'))
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
      console.log(chalk.yellowBright('\nInfo: The format of the file may be damaged. If necessary, please use eslint to process it uniformly \n'))
    }) 
  })
}

export { cc2fc }