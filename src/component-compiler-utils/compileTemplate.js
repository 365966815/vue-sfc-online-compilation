"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assetUrl_1 = __importDefault(require("./templateCompilerModules/assetUrl"));
const srcset_1 = __importDefault(require("./templateCompilerModules/srcset"));
// const consolidate = require('consolidate');
const transpile = require('vue-template-es2015-compiler');
function compileTemplate(options) {
    const { preprocessLang } = options;
    /**
     * TODO  preprocessLang
     */
    // const preprocessor = preprocessLang && consolidate[preprocessLang];
    const preprocessor = preprocessLang ;
    if (preprocessor) {
        return actuallyCompile(Object.assign({}, options, {
            source: preprocess(options, preprocessor)
        }));
    }
    else if (preprocessLang) {
        return {
            ast: {},
            code: `var render = function () {}\n` + `var staticRenderFns = []\n`,
            source: options.source,
            tips: [
                `Component ${options.filename} uses lang ${preprocessLang} for template. Please install the language preprocessor.`
            ],
            errors: [
                `Component ${options.filename} uses lang ${preprocessLang} for template, however it is not installed.`
            ]
        };
    }
    else {
        return actuallyCompile(options);
    }
}
exports.compileTemplate = compileTemplate;
function preprocess(options, preprocessor) {
    const { source, filename, preprocessOptions } = options;
    const finalPreprocessOptions = Object.assign({
        filename
    }, preprocessOptions);
    // Consolidate exposes a callback based API, but the callback is in fact
    // called synchronously for most templating engines. In our case, we have to
    // expose a synchronous API so that it is usable in Jest transforms (which
    // have to be sync because they are applied via Node.js require hooks)
    let res, err;
    preprocessor.render(source, finalPreprocessOptions, (_err, _res) => {
        if (_err)
            err = _err;
        res = _res;
    });
    if (err)
        throw err;
    return res;
}
function actuallyCompile(options) {
    const { source, compiler, compilerOptions = {}, transpileOptions = {}, transformAssetUrls, isProduction = process.env.NODE_ENV === 'production', isFunctional = false, optimizeSSR = false, prettify = true } = options;
    const compile = optimizeSSR && compiler.ssrCompile ? compiler.ssrCompile : compiler.compile;
    let finalCompilerOptions = compilerOptions;
    if (transformAssetUrls) {
        const builtInModules = [
            transformAssetUrls === true
                ? assetUrl_1.default()
                : assetUrl_1.default(transformAssetUrls),
            srcset_1.default()
        ];
        finalCompilerOptions = Object.assign({}, compilerOptions, {
            modules: [...builtInModules, ...(compilerOptions.modules || [])],
            filename: options.filename
        });
    }
    const { ast, render, staticRenderFns, tips, errors } = compile(source, finalCompilerOptions);
    if (errors && errors.length) {
        return {
            ast,
            code: `var render = function () {}\n` + `var staticRenderFns = []\n`,
            source,
            tips,
            errors
        };
    }
    else {
        const finalTranspileOptions = Object.assign({}, transpileOptions, {
            transforms: Object.assign({}, transpileOptions.transforms, {
                stripWithFunctional: isFunctional
            })
        });
        const toFunction = (code) => {
            return `function (${isFunctional ? `_h,_vm` : ``}) {${code}}`;
        };
        // transpile code with vue-template-es2015-compiler, which is a forked
        // version of Buble that applies ES2015 transforms + stripping `with` usage
        let code = transpile(`var __render__ = ${toFunction(render)}\n` +
            `var __staticRenderFns__ = [${staticRenderFns.map(toFunction)}]`, finalTranspileOptions) + `\n`;
        // #23 we use __render__ to avoid `render` not being prefixed by the
        // transpiler when stripping with, but revert it back to `render` to
        // maintain backwards compat
        code = code.replace(/\s__(render|staticRenderFns)__\s/g, ' $1 ');
        return {
            ast,
            code,
            source,
            tips,
            errors
        };
    }
}
