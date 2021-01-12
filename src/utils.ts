import fs from 'fs'
import recast from 'recast'

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

export const useStateExpressionStatement = ({
    stateName, 
    setStateName,
    defaultValue
}) => {
    const useState = identifier('useState')
    return variableDeclaration('const', [
        variableDeclarator(arrayPattern([identifier(stateName), identifier(setStateName)]), callExpression(useState, [
            identifier(defaultValue)
        ]))
    ])
}

export const reactFunctionComponentDeclaration = (FCName, {
    props = [],
    content = []
}) => {
    return variableDeclaration('const', [
        variableDeclarator(identifier(FCName), arrowFunctionExpression([...props.map(i=> identifier(i))], blockStatement([...content])))
    ])
}

export const setStateAction = (str: string)=> {
    return 'set' + str[0].toLocaleUpperCase() + str.substr(1)
}

export const originalCode = parseAst => recast.print(parseAst).code

export const transformSetState = (stateStrParse) => {
    return stateStrParse.map(item=>{
        return callExpression(
            identifier(setStateAction(item.key.name)),
            [item.value]
        )
    }) 
}

export const transformState = (body) => {
    let str = originalCode(body)
    const res = transformSetStateToHooks(str)
    res.forEach(element => {
        str = str.replace(element.originalCode, element.code.join('\n'))
    })
    str = str.replace(/(this\.state\.)|(this\.)/g, '')
    return recast.parse(str).program.body[0].body
}

export const transformSetStateToHooks = (str) => {
    const thisSetStateMatch = str.split('this.setState(').slice(1)

    return thisSetStateMatch.reduce((acc, item) => {
        const thisSetStateStr = 'const thisSetStateStr =' + findObjectStr(item)
        const thisSetStateStrParse = recast.parse(thisSetStateStr).program.body[0].declarations[0].init.properties

        acc.push({
            originalCode: 'this.setState(' + findObjectStr(item) + ')',
            code: transformSetState(thisSetStateStrParse).map(i=> recast.print(i).code)
        })
        return acc
    }, [])
}

export const JSXReturnExpressionStatement = (val) => {
    if(val.length === 1) return val[0]

    return returnStatement(callExpression(arrowFunctionExpression([], blockStatement([...val])), []))
}

export const createImportSpecifier = (name) => {
    return importSpecifier(identifier(name))
}

const findObjectStr = (str: string) => {
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
}