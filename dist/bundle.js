'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var recast = require('recast');
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var child_process = require('child_process');
var inquirer = require('inquirer');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var recast__default = /*#__PURE__*/_interopDefaultLegacy(recast);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
}

var _a = recast__default['default'].types.builders, expressionStatement = _a.expressionStatement, callExpression = _a.callExpression, identifier = _a.identifier, arrowFunctionExpression = _a.arrowFunctionExpression, blockStatement = _a.blockStatement, returnStatement = _a.returnStatement, arrayExpression = _a.arrayExpression, variableDeclaration = _a.variableDeclaration, variableDeclarator = _a.variableDeclarator, arrayPattern = _a.arrayPattern, importSpecifier = _a.importSpecifier;
var includeFile = ['.js'];
var matchSuffix = function (str) {
    var res = str.match(/\.\w+/g);
    return res ? res[res.length - 1] : '';
};
var traverseFile = function (src, callback) {
    var paths = fs__default['default'].readdirSync(src).filter(function (item) { return item !== 'node_modules'; });
    paths.forEach(function (path) {
        var _src = src + '/' + path;
        var statSyncRes = fs__default['default'].statSync(_src);
        if (statSyncRes.isFile() && includeFile.includes(matchSuffix(path))) {
            callback(_src);
        }
        else if (statSyncRes.isDirectory()) { //是目录则 递归 
            traverseFile(_src, callback);
        }
    });
};
/**
 * 获取node命令参数
 *
 * 输入 dian-codemod reverse-less file-path1 files-path2
 *
 *  getArgvs() 返回 [file-path1, files-path2]
*/
var getArgvs = function () { return __spreadArrays(process.argv).splice(3); };
/**
 * 创建一个类似 useEffect(()=>{
 *   ...something
 * },[])
 * 暂不支持第二个参数自动生成
*/
var useEffectExpressionStatement = function (_a) {
    var _b = _a.props, props = _b === void 0 ? [] : _b, _c = _a.content, content = _c === void 0 ? [] : _c, _d = _a.returnContent, returnContent = _d === void 0 ? [] : _d;
    var useEffect = identifier('useEffect');
    return expressionStatement(callExpression(useEffect, [
        arrowFunctionExpression(__spreadArrays(props), blockStatement(__spreadArrays(content, (returnContent
            ? [returnStatement(arrowFunctionExpression([], blockStatement(__spreadArrays(returnContent))))]
            : [])))),
        arrayExpression([])
    ]));
};
/**
 * 创建一个类似 const [name, setName] = useState() 表达式
*/
var useStateExpressionStatement = function (_a) {
    var stateName = _a.stateName, setStateName = _a.setStateName, defaultValue = _a.defaultValue;
    var useState = identifier('useState');
    return variableDeclaration('const', [
        variableDeclarator(arrayPattern([identifier(stateName), identifier(setStateName)]), callExpression(useState, [
            identifier(defaultValue)
        ]))
    ]);
};
/**
 * 创建一个 react 函数表达式
*/
var reactFunctionComponentDeclaration = function (FCName, _a) {
    var _b = _a.props, props = _b === void 0 ? [] : _b, _c = _a.content, content = _c === void 0 ? [] : _c;
    return variableDeclaration('const', [
        variableDeclarator(identifier(FCName), arrowFunctionExpression(__spreadArrays(props.map(function (i) { return identifier(i); })), blockStatement(__spreadArrays(content))))
    ]);
};
/**
 * name => setName
*/
var setStateAction = function (str) {
    return 'set' + str[0].toLocaleUpperCase() + str.substr(1);
};
/**
 * get originalCode
*/
var originalCode = function (parseAst) { return recast__default['default'].print(parseAst).code; };
/**
 * 生成 setState 表达式
*/
var transformSetState = function (stateStrParse) {
    return stateStrParse.map(function (item) {
        return callExpression(identifier(setStateAction(item.key.name)), [item.value]);
    });
};
/**
 * 处理this this.state 和 this.setState
*/
var transformState = function (body) {
    var str = originalCode(body);
    var res = transformSetStateToHooks(str);
    res.forEach(function (element) {
        str = str.replace(element.originalCode, element.code.join('\n'));
    });
    str = str.replace(/(this\.state\.)|(this\.)/g, '');
    return recast__default['default'].parse(str).program.body[0].body;
};
/**
 * this.setState => setState
 * this.setState({
 *   name: 'xiaoming',
 *   age: 21
 * }) => setName('xiaoming') \n setAge(21)
 *
*/
var transformSetStateToHooks = function (str) {
    var thisSetStateMatch = str.split('this.setState(').slice(1);
    return thisSetStateMatch.reduce(function (acc, item) {
        var thisSetStateStr = 'const thisSetStateStr =' + findObjectStr(item);
        var thisSetStateStrParse = recast__default['default'].parse(thisSetStateStr).program.body[0].declarations[0].init.properties;
        acc.push({
            originalCode: 'this.setState(' + findObjectStr(item) + ')',
            code: transformSetState(thisSetStateStrParse).map(function (i) { return recast__default['default'].print(i).code; })
        });
        return acc;
    }, []);
};
/**
 * 对 render 处理
 * 若是render里面只包含return，则直接返回
 * 否则生成一个立即执行函数，把render里面return前的操作置前
*/
var JSXReturnExpressionStatement = function (val) {
    if (val.length === 1)
        return [val[0]];
    // return [returnStatement(callExpression(arrowFunctionExpression([], blockStatement([...val])), []))]
    return __spreadArrays(val);
};
/**
 * 生成一个导入说明符
*/
var createImportSpecifier = function (name) {
    return importSpecifier(identifier(name));
};
/**
 * 匹配出一个字符串对象
*/
var findObjectStr = function (str) {
    var res = { str: '', count: 0 };
    str.split('').some(function (item) {
        if (res.str.includes('{') && !res.count)
            return true;
        res.str += item;
        if (item === '{') {
            res.count++;
        }
        else if (item === '}') {
            res.count--;
        }
    });
    return res.str;
};
/**
 * prompt 提示 是否继续操作
*/
var continueExec = function () {
    var promptList = [
        {
            type: 'choices',
            name: 'isContinue',
            message: '是否继续操作: (Y/N)?',
            default: 'N'
        },
    ];
    return new Promise(function (resolve, reject) {
        inquirer.prompt(promptList).then(function (res) {
            res.isContinue === 'Y' && resolve(true);
        }).catch(function () {
            reject();
        });
    });
};
/**
 * 检测当前分支status，若是有被修改的文件，则提示
*/
var isChangesNotStagedForCommit = function () {
    var CHANGES_NOT_STAGED_FOR_COMMIT = 'Changes not staged for commit';
    return new Promise(function (resolve) {
        child_process.exec('git status', function (err, stdout, stderr) {
            if (err) {
                console.log(chalk__default['default'].red('当前目录并未检测到git信息, 执行命令可能会对文件造成无法恢复的情况'));
                continueExec().then(function () {
                    resolve(true);
                });
            }
            else {
                if (stdout.includes(CHANGES_NOT_STAGED_FOR_COMMIT)) {
                    console.log(chalk__default['default'].red('你有变更的文件未提交，为了确保你的分支不被破坏，请处理后再次执行此命令'));
                    console.log(chalk__default['default'].red('若是你确保分支安全情况下，你仍可以继续操作'));
                    continueExec().then(function () {
                        resolve(true);
                    });
                }
                else
                    resolve(true);
            }
        });
    });
};

var Types;
(function (Types) {
    Types["ClassDeclaration"] = "ClassDeclaration";
    Types["Component"] = "Component";
    Types["AssignmentExpression"] = "AssignmentExpression";
    Types["ThisExpression"] = "ThisExpression";
    Types["VariableDeclaration"] = "VariableDeclaration";
    Types["ExpressionStatement"] = "ExpressionStatement";
    Types["ImportDeclaration"] = "ImportDeclaration";
    Types["ExportDefaultDeclaration"] = "ExportDefaultDeclaration";
    Types["ExportNamedDeclaration"] = "ExportNamedDeclaration";
})(Types || (Types = {}));
var ComponentLifecycleTypes;
(function (ComponentLifecycleTypes) {
    // DeprecatedLifecycle
    ComponentLifecycleTypes["componentWillMount"] = "componentWillMount";
    ComponentLifecycleTypes["UNSAFE_componentWillMount"] = "UNSAFE_componentWillMount";
    ComponentLifecycleTypes["componentWillReceiveProps"] = "componentWillReceiveProps";
    ComponentLifecycleTypes["UNSAFE_componentWillReceiveProps"] = "UNSAFE_componentWillReceiveProps";
    ComponentLifecycleTypes["componentWillUpdate"] = "componentWillUpdate";
    ComponentLifecycleTypes["UNSAFE_componentWillUpdate"] = "UNSAFE_componentWillUpdate";
    // NewLifecycle
    ComponentLifecycleTypes["getSnapshotBeforeUpdate"] = "getSnapshotBeforeUpdate";
    ComponentLifecycleTypes["componentDidUpdate"] = "componentDidUpdate";
    // StaticLifecycle
    ComponentLifecycleTypes["getDerivedStateFromProps"] = "getDerivedStateFromProps";
    ComponentLifecycleTypes["getDerivedStateFromError"] = "getDerivedStateFromError";
    // ComponentLifecycle
    ComponentLifecycleTypes["componentDidMount"] = "componentDidMount";
    ComponentLifecycleTypes["shouldComponentUpdate"] = "shouldComponentUpdate";
    ComponentLifecycleTypes["componentWillUnmount"] = "componentWillUnmount";
    ComponentLifecycleTypes["componentDidCatch"] = "componentDidCatch";
    // others
    ComponentLifecycleTypes["render"] = "render";
    ComponentLifecycleTypes["constructor"] = "constructor";
    ComponentLifecycleTypes["getInitialState"] = "getInitialState";
    ComponentLifecycleTypes["getDefaultProps"] = "getDefaultProps";
})(ComponentLifecycleTypes || (ComponentLifecycleTypes = {}));

var _a$1 = recast__default['default'].types.builders, exportDefaultDeclaration = _a$1.exportDefaultDeclaration, exportNamedDeclaration = _a$1.exportNamedDeclaration, identifier$1 = _a$1.identifier;
var cwd = process.cwd() + '/';
var NotSupportComponentLifecycle = [
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
];
var dealConstructor = function (constructorBody, acc) {
    constructorBody.forEach(function (constructorItem) {
        // 找到 this.state 
        var expression = constructorItem.expression;
        if (expression
            && expression.type === Types.AssignmentExpression
            && expression.operator === '='
            && expression.left.object.type === Types.ThisExpression
            && expression.left.property.name === 'state') {
            var stateRights = expression.right.properties;
            stateRights.forEach(function (stateRight) {
                acc.state.push(useStateExpressionStatement({
                    stateName: stateRight.key.name,
                    setStateName: setStateAction(stateRight.key.name),
                    defaultValue: originalCode(stateRight.value)
                }));
            });
        }
    });
};
var dealComponentBody = function (item, transformInfo, filePath) {
    // 不支持的生命周期，暂且不管
    if (item.body.body.some(function (i) { return NotSupportComponentLifecycle.includes(i.key.name); })) {
        console.log(chalk__default['default'].yellow(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: Unsupported life cycle'));
        return item;
    }
    else {
        try {
            var reactFCBody = item.body.body.reduce(function (acc, i) {
                if (i.key.name === ComponentLifecycleTypes.constructor) {
                    var constructorBody = i.value.body.body;
                    // 只校验 存在 super(props) 和 this.state = { name: 'xiaoming' } 这种情况
                    if (constructorBody.every(function (constructorItem) { return constructorItem.type === Types.ExpressionStatement; })) {
                        transformInfo.useState = true;
                        dealConstructor(constructorBody, acc);
                    }
                    else {
                        transformInfo.canConstructorSupport = false;
                        console.log(chalk__default['default'].yellow(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: constructor content not support'));
                        return item;
                    }
                }
                else if (i.key.name === ComponentLifecycleTypes.componentDidMount
                    || i.key.name === ComponentLifecycleTypes.UNSAFE_componentWillMount
                    || i.key.name === ComponentLifecycleTypes.componentWillMount) {
                    transformInfo.useEffect = true;
                    acc.componentDidMount = transformState(i.value.body);
                }
                else if (i.key.name === ComponentLifecycleTypes.componentWillUnmount) {
                    transformInfo.useEffect = true;
                    acc.componentWillUnmount = transformState(i.value.body);
                }
                else if (i.key.name === ComponentLifecycleTypes.render) {
                    acc.return = transformState(i.value.body);
                }
                else {
                    acc.methods.push(reactFunctionComponentDeclaration(i.key.name, {
                        props: i.value.params.map(function (param) { return param.name; }),
                        content: i.value.body.body
                    }));
                }
                return acc;
            }, {
                state: [],
                methods: [],
                componentDidMount: [],
                componentWillUnmount: [],
                return: null
            });
            var rfc = reactFunctionComponentDeclaration(item.id.name, {
                props: ['props'],
                content: __spreadArrays((reactFCBody.state || []), (reactFCBody.methods || []), ((reactFCBody.componentDidMount.length
                    || reactFCBody.componentWillUnmount.length) ? [useEffectExpressionStatement({
                        content: reactFCBody.componentDidMount,
                        returnContent: reactFCBody.componentWillUnmount
                    })] : []), JSXReturnExpressionStatement(reactFCBody.return || []))
            });
            transformInfo.canTransform = true;
            return rfc;
        }
        catch (e) {
            console.log(chalk__default['default'].red(filePath.replace(cwd, '') + 'Can\'t be converted! the reason: ' + e.description));
            return item;
        }
    }
};
var isReactComponent = function (item) { return item.type === Types.ClassDeclaration && item.superClass.name === Types.Component; };
var isExportDefaultDeclaration = function (item) { return item.type === Types.ExportDefaultDeclaration && isReactComponent(item.declaration); };
var isExportNamedDeclaration = function (item) { return item.type === Types.ExportNamedDeclaration && isReactComponent(item.declaration); };
var reactClassComponentToFunctionComponent = function (filePath) {
    var code = fs__default['default'].readFileSync(filePath, { encoding: 'utf8' }).toString();
    var initializer = recast__default['default'].parse(code);
    var transformInfo = {
        useState: false,
        useEffect: false,
        canTransform: false,
        canConstructorSupport: true
    };
    // 遍历文件当前页面第一层级结构
    var res = initializer.program.body.reduce(function (accumulate, item) {
        // export default class Demo extends Component
        if (isExportDefaultDeclaration(item)) {
            accumulate.push(dealComponentBody(item.declaration, transformInfo, filePath), exportDefaultDeclaration(identifier$1(item.declaration.id.name)));
        }
        else if (isExportNamedDeclaration(item)) {
            // export class Demo extends Component
            accumulate.push(exportNamedDeclaration(dealComponentBody(item.declaration, transformInfo, filePath)));
        }
        else if (isReactComponent(item)) {
            // class Demo extends Component
            accumulate.push(dealComponentBody(item, transformInfo, filePath));
        }
        else {
            accumulate.push(item);
        }
        return accumulate;
    }, []);
    res.forEach(function (item) {
        if (item.type === Types.ImportDeclaration && item.source.value === 'react') {
            Object.entries(transformInfo).filter(function (_a) {
                var key = _a[0];
                return key !== 'canTransform' && key !== 'canConstructorSupport';
            }).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                if (value) {
                    item.specifiers.push(createImportSpecifier(key));
                    // remove import React, { Component } from 'react' 中的 Component
                    var ComponentIndex = item.specifiers.findIndex(function (i) { var _a; return ((_a = i.imported) === null || _a === void 0 ? void 0 : _a.name) === Types.Component; });
                    if (ComponentIndex !== -1) {
                        item.specifiers.splice(ComponentIndex, 1);
                    }
                }
            });
        }
    });
    initializer.program.body = res;
    if (transformInfo.canTransform && transformInfo.canConstructorSupport) {
        fs__default['default'].writeFile(path__default['default'].resolve(filePath), recast__default['default'].print(initializer).code, {}, function (err) {
            if (err)
                console.log(err);
            console.log(chalk__default['default'].green('🎉 🎉 🎉 ' + filePath.replace(cwd, '') + ' Successful transform!!!'));
        });
    }
};
var cc2fc = function () {
    isChangesNotStagedForCommit().then(function () {
        var argvs = getArgvs().map(function (item) {
            if (item.substr(item.length - 1) === '/') {
                return item.substr(0, item.length - 1);
            }
            return item;
        });
        if (argvs.length !== 1) {
            console.log(chalk__default['default'].red('only supports commands react-cc2dc start filePath'));
            return;
        }
        fs__default['default'].stat(cwd + argvs[0], function (err, data) {
            if (data.isFile()) {
                reactClassComponentToFunctionComponent(cwd + argvs[0]);
            }
            else {
                traverseFile(cwd + argvs[0], function (path) {
                    reactClassComponentToFunctionComponent(path);
                });
            }
            console.log(chalk__default['default'].redBright('\n The format of the file may be damaged. If necessary, please use eslint to process it uniformly \n'));
        });
    });
};

exports.cc2fc = cc2fc;
