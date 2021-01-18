import fs from 'fs'
import recast from 'recast'
import { exec } from 'child_process'
import { prompt } from 'inquirer'
import chalk from 'chalk'

const {
    expressionStatement,
    callExpression,
    identifier,
    arrowFunctionExpression,
    blockStatement,
    returnStatement,
    arrayExpression,
    variableDeclaration,
    variableDeclarator,
    arrayPattern,
    importSpecifier,
    spreadElement,
    objectExpression,
} = recast.types.builders

const includeFile = ['.js']

const matchSuffix = (str: string)=> {
    const res = str.match(/\.\w+/g)
    return res ? res[res.length-1] : ''
}

export const traverseFile= (src ,callback) => {
    let paths = fs.readdirSync(src).filter(item=> item !== 'node_modules')
    paths.forEach(path => {
        const _src = src + '/' + path
        const statSyncRes = fs.statSync(_src)
        if(statSyncRes.isFile() && includeFile.includes(matchSuffix(path))) {
            callback(_src)
        } else if(statSyncRes.isDirectory()){ //是目录则 递归 
            traverseFile(_src, callback)
        }
    })
}

/**
 * 获取node命令参数
 * 
 * 输入 dian-codemod reverse-less file-path1 files-path2
 * 
 *  getArgvs() 返回 [file-path1, files-path2]
*/
export const getArgvs = () => [...process.argv].splice(3)

export const recastBabel = {
    parse: code => recast.parse(code, { parser: require('recast/parsers/babel') }),
    print: ast => recast.print(ast, { parser: require('recast/parsers/babel') }).code
}

/**
 * 创建一个类似 useEffect(()=>{
 *   ...something
 * },[])
 * 暂不支持第二个参数自动生成
*/
export const useEffectExpressionStatement = ({
    props = [],
    content = [],
    returnContent =[ ]
}) => {
    const useEffect = identifier('useEffect')
    return expressionStatement(
        callExpression(
            useEffect,
            [
                arrowFunctionExpression(
                    [...props],
                    blockStatement([
                        ...content,
                        ...(returnContent 
                            ? [returnStatement(arrowFunctionExpression([], blockStatement([...returnContent])))] 
                            : [])
                    ])
                ),
                arrayExpression([])
            ]
        )
    )
}

export const createUseStateFunctionArguments = (expression, state) => {
    return arrowFunctionExpression([], blockStatement([
        ...expression,
        returnStatement(state)
    ]))
}

/**
 * 创建一个类似 const [name, setName] = useState() 表达式
*/
export const useStateExpressionStatement = (defaultValue) => {
    const useState = identifier('useState')
    return variableDeclaration('const', [
        variableDeclarator(arrayPattern([identifier('state'), identifier('setState')]), callExpression(useState, [
            defaultValue
        ]))
    ])
}

/**
 * 创建一个 react 函数表达式 
*/
export const reactFunctionComponentDeclaration = (FCName, {
    props = [],
    content = []
}) => {
    return variableDeclaration('const', [
        variableDeclarator(identifier(FCName), arrowFunctionExpression([...props], blockStatement([...content])))
    ])
}

/**
 * get originalCode
*/
export const originalCode = parseAst => recastBabel.print(parseAst)

/**
 * 生成 setState 表达式
*/
const transformSetState = stateStrParse => {
    return callExpression(identifier('setState'), [
        objectExpression([spreadElement(identifier('state')), ...(
            stateStrParse.length ? stateStrParse : [spreadElement(identifier(stateStrParse.name))]
        )]),
    ])
}

/**
 * 处理this this.state 和 this.setState
*/
export const transformState = body => {
    let str = originalCode(body)
    const res = transformSetStateToHooks(str)
    res.forEach(element => {
        str = str.replace(element.originalCode, element.code)
    })
    str = str.replace(/this\./g, '')
    return recastBabel.parse(str).program.body[0].body
}

/**
 * this.setState => setState
 * this.setState({
 *   name: 'xiaoming',
 *   age: 21
 * }) => setName('xiaoming') \n setAge(21)
 * 
*/
const transformSetStateToHooks = str => {
    const thisSetStateMatch = str.split('this.setState(').slice(1)
    return thisSetStateMatch.reduce((acc, item) => {
        const thisSetStateStr = 'const thisSetStateStr =' + findObjectStr(item)
        var init = recastBabel.parse(thisSetStateStr).program.body[0].declarations[0].init;
        var thisSetStateStrParse = init.properties ? init.properties : init;
        acc.push({
            originalCode: 'this.setState(' + findObjectStr(item) + ')',
            code: recastBabel.print(transformSetState(thisSetStateStrParse))
        })
        return acc
    }, [])
}

/**
 * 对 render 处理
 * 若是render里面只包含return，则直接返回
 * 否则生成一个立即执行函数，把render里面return前的操作置前
*/
export const JSXReturnExpressionStatement = (val) => {
    if(val.length === 1) return [val[0]]
    // return [returnStatement(callExpression(arrowFunctionExpression([], blockStatement([...val])), []))]
    return [...val]
}

/**
 * 生成一个导入说明符
*/
export const createImportSpecifier = (name) => {
    return importSpecifier(identifier(name))
}

/**
 * 匹配出一个字符串对象
*/
const findObjectStr = (str: string) => {
    if(str[0] === '{') {
        const res = { str: '', count: 0 }
        str.split('').some(item=> {
            if(res.str.includes('{') && !res.count) return true
            res.str += item
            if(item === '{') {
                res.count++
            } else if(item === '}') {
                res.count--
            }
        })
        return res.str
    } else {
        return str.split(')')[0]
    }
    
}

/**
 * prompt 提示 是否继续操作
*/
export const continueExec = ()=> {
    const promptList = [
        {
            type: 'choices',
            name: 'isContinue',
            message: '是否继续操作: (Y/N)?',
            default: 'N'
        },
    ]
    return new Promise((resolve, reject)=> {
        prompt(promptList).then(res=> {
            res.isContinue === 'Y' && resolve(true)
        }).catch(()=> {
            reject()
        })
    })
}

/**
 * 检测当前分支status，若是有被修改的文件，则提示
*/
export const isChangesNotStagedForCommit= () => {
    const CHANGES_NOT_STAGED_FOR_COMMIT = 'Changes not staged for commit'
   
    return new Promise(resolve=> {
        exec('git status', (err, stdout, stderr) => {
            if (err) {
                console.log(chalk.red('当前目录并未检测到git信息, 执行命令可能会对文件造成无法恢复的情况'))
                continueExec().then(()=> {
                    resolve(true)
                })
            } else {
                if(stdout.includes(CHANGES_NOT_STAGED_FOR_COMMIT)) {
                   console.log(chalk.red('你有变更的文件未提交，为了确保你的分支不被破坏，请处理后再次执行此命令'))
                   console.log(chalk.red('若是你确保分支安全情况下，你仍可以继续操作'))
                   continueExec().then(()=> {
                        resolve(true)
                    })
                } else resolve(true)
            }
        })
    })
}