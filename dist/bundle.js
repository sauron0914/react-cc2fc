'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var recast = require('recast');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var recast__default = /*#__PURE__*/_interopDefaultLegacy(recast);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

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
var useStateExpressionStatement = function (_a) {
    var stateName = _a.stateName, setStateName = _a.setStateName, defaultValue = _a.defaultValue;
    var useState = identifier('useState');
    return variableDeclaration('const', [
        variableDeclarator(arrayPattern([identifier(stateName), identifier(setStateName)]), callExpression(useState, [
            identifier(defaultValue)
        ]))
    ]);
};
var reactFunctionComponentDeclaration = function (FCName, _a) {
    var _b = _a.props, props = _b === void 0 ? [] : _b, _c = _a.content, content = _c === void 0 ? [] : _c;
    return variableDeclaration('const', [
        variableDeclarator(identifier(FCName), arrowFunctionExpression(__spreadArrays(props.map(function (i) { return identifier(i); })), blockStatement(__spreadArrays(content))))
    ]);
};
var setStateAction = function (str) {
    return 'set' + str[0].toLocaleUpperCase() + str.substr(1);
};
var originalCode = function (parseAst) { return recast__default['default'].print(parseAst).code; };
var transformSetState = function (stateStrParse) {
    return stateStrParse.map(function (item) {
        return callExpression(identifier(setStateAction(item.key.name)), [item.value]);
    });
};
var transformState = function (body) {
    var str = originalCode(body);
    var res = transformSetStateToHooks(str);
    res.forEach(function (element) {
        str = str.replace(element.originalCode, element.code.join('\n'));
    });
    str = str.replace(/(this\.state\.)|(this\.)/g, '');
    return recast__default['default'].parse(str).program.body[0].body;
};
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
var JSXReturnExpressionStatement = function (val) {
    if (val.length === 1)
        return val[0];
    return returnStatement(callExpression(arrowFunctionExpression([], blockStatement(__spreadArrays(val))), []));
};
var createImportSpecifier = function (name) {
    return importSpecifier(identifier(name));
};
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

var Types;
(function (Types) {
    Types["ClassDeclaration"] = "ClassDeclaration";
    Types["Component"] = "Component";
    Types["AssignmentExpression"] = "AssignmentExpression";
    Types["ThisExpression"] = "ThisExpression";
    Types["VariableDeclaration"] = "VariableDeclaration";
    Types["ExpressionStatement"] = "ExpressionStatement";
    Types["ImportDeclaration"] = "ImportDeclaration";
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
var removeRedundancy = function () {
    var code = fs__default['default'].readFileSync(cwd + 'src/description.js', { encoding: 'utf8' }).toString();
    var initializer = recast__default['default'].parse(code);
    var specifierInfo = {
        useState: false,
        useEffect: false
    };
    // 遍历文件当前页面第一层级结构
    var res = initializer.program.body.reduce(function (accumulate, item) {
        if (item.type === Types.ClassDeclaration && item.superClass.name === Types.Component) {
            // 获取 react class component body 结构
            var reactClassComponentBody = item.body.body;
            // 不支持的生命周期，暂且不管
            if (reactClassComponentBody.some(function (i) { return NotSupportComponentLifecycle.includes(i.key.name); })) {
                accumulate.push(item);
            }
            else {
                var reactFCBody = reactClassComponentBody.reduce(function (acc, i) {
                    if (i.key.name === ComponentLifecycleTypes.constructor) {
                        var constructorBody = i.value.body.body;
                        // 只校验 存在 super(props) 和 this.state = { name: 'xiaoming' } 这种情况
                        if (constructorBody.every(function (constructorItem) { return constructorItem.type === Types.ExpressionStatement; })) {
                            specifierInfo.useState = true;
                            dealConstructor(constructorBody, acc);
                        }
                        else {
                            accumulate.push(item);
                        }
                    }
                    else if (i.key.name === ComponentLifecycleTypes.componentDidMount
                        || i.key.name === ComponentLifecycleTypes.UNSAFE_componentWillMount
                        || i.key.name === ComponentLifecycleTypes.componentWillMount) {
                        specifierInfo.useEffect = true;
                        acc.componentDidMount = transformState(i.value.body);
                    }
                    else if (i.key.name === ComponentLifecycleTypes.componentWillUnmount) {
                        specifierInfo.useEffect = true;
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
                    content: __spreadArrays(reactFCBody.state, reactFCBody.methods, [
                        useEffectExpressionStatement({
                            content: reactFCBody.componentDidMount,
                            returnContent: reactFCBody.componentWillUnmount
                        }),
                        JSXReturnExpressionStatement(reactFCBody.return)
                    ])
                });
                accumulate.push(rfc);
            }
        }
        else {
            accumulate.push(item);
        }
        return accumulate;
    }, []);
    res.forEach(function (item) {
        if (item.type === Types.ImportDeclaration && item.source.value === 'react') {
            Object.entries(specifierInfo).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                if (value)
                    item.specifiers.push(createImportSpecifier(key));
            });
        }
    });
    initializer.program.body = res;
    console.log(recast__default['default'].print(initializer).code);
};

exports.removeRedundancy = removeRedundancy;
