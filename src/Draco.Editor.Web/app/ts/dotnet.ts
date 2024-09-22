import { downloadAssemblies } from './cache.js';
// this file handle the communication with the .NET worker.

const compilerWorker = new Worker('worker.js'); // first thing: we start the worker so it loads in parallel.
let runtimeWorker: Worker | undefined;
let listeners: ((arg: { outputType: string; value: string; clear: boolean }) => void)[] = [];
let jsModuleNativeName: string | undefined;
let jsModuleRuntimeName: string | undefined;
compilerWorker.onmessage = async (ev) => {
    const msg = ev.data as {
        type: string;
        message: string;
    };
    switch (msg.type) {
    case 'setOutputText': { // the worker is sending us some output
        const parsed = JSON.parse(msg.message);
        onOutputChange(parsed['OutputType'], parsed['Text'], true);
        break;
    }
    case 'runtimeAssembly': { // the worker sent a compiled dll to run.
        if (runtimeWorker != undefined) {
            runtimeWorker.terminate();
        }
        onOutputChange('stdout', 'Loading script\'s .NET Runtime...', true);

        runtimeWorker = new Worker('worker.js');

        // our small dotnet wrapper around the compiler:
        // listed all the assemblies that this dll will need
        // and built a json that mono wasm understand to run a .NET dll.

        // the small wrapepr part generate an ideal config file, this script here bring the reality back to it: dotnet js api is far from being usable.
        const cfg = JSON.parse(msg.message);
        console.log('Starting worker with boot config:');

        cfg['disableInterop'] = true; // we don't do js-dotnet interop in user dlls for now.
        const assets = cfg['assets'];
        // for some reason, mono js really need these two files. why does it doesn't do itself ? good question.
        assets.unshift({
            name: jsModuleNativeName,
            behavior: 'js-module-native',
        });
        assets.unshift({
            name: jsModuleRuntimeName,
            behavior: 'js-module-runtime',
        });
        await downloadAssemblies(cfg); // this download the assemblies by ourself, i explain in the function why we do that.
        runtimeWorker.postMessage(cfg); // we send the config to the worker.
        let shouldClean = true;
        runtimeWorker.onmessage = (e) => {
            const runtimeMsg = e.data as {
                type: string;
                message: string;
            };
            switch (runtimeMsg.type) {
            case 'stdout':
                onOutputChange('stdout', runtimeMsg.message + '\n', shouldClean);
                shouldClean = false;
                break;
            default:
                console.error('Runtime sent unknown message', runtimeMsg);
                break;
            }
        };
        break;
    }
    default:
        console.log('Runtime sent unknown message', msg);
        break;
    }
};

export function setCode(code: string) {
    compilerWorker.postMessage({
        type: 'CodeChange',
        payload: code
    });
}

function onOutputChange(outputType: string, value: string, clear: boolean) {
    listeners.forEach(s => s({
        outputType: outputType,
        value: value,
        clear: clear
    }));
}

export function subscribeOutputChange(listener: (arg: { outputType: string; value: string; clear: boolean }) => void) {
    listeners.push(listener);
}

export function unsubscribeOutputChange(listener: (arg: { outputType: string; value: string }) => void) {
    listeners = listeners.filter(s => s != listener);
}

export async function initDotnetWorkers(initCode: string) {
    // msbuild generated a shiny file for dotnet js, it's called blazor even if we don't use blazor
    const cfg = await (await fetch('_framework/blazor.boot.json')).json();
    // dotnet js doesn't cache dlls, so we again use our download mechanism to cache them.
    // also, there is multiple way to structure this config file, because why not.
    // and the way msbuild generate this file, don't allow to use the buffer trick explained in cache.ts.
    // so I recreate the config file, using this config structure that i understand.
    console.log(cfg);
    const assets: unknown[] = Object.keys(cfg.resources.assembly).map( // this rewrite the msbuild generated config into the config structure i use.
        s => {
            return {
                'behavior': 'assembly',
                'name': s
            };
        }
    );
    assets.unshift({
        'behavior': 'dotnetwasm',
        'name': 'dotnet.native.wasm'
    });

    // if i remember correctly, the file structure they use have dedicated fields to specify theses 2 files
    // since we don't use their file strucutre, we have to add them manually.
    // Luckily, we can just pull the value from the msbuild generated file.

    jsModuleNativeName = Object.keys(cfg['resources']['jsModuleNative'])[0];
    assets.unshift({
        name: jsModuleNativeName,
        behavior: 'js-module-native',
    });
    jsModuleRuntimeName = Object.keys(cfg['resources']['jsModuleRuntime'])[0];
    assets.unshift({
        name: jsModuleRuntimeName,
        behavior: 'js-module-runtime',
    });

    const bootCfg = {
        mainAssemblyName: cfg.mainAssemblyName,
        assets: assets,
    };
    await downloadAssemblies(bootCfg);
    console.log(bootCfg);
    compilerWorker.postMessage(bootCfg);
    compilerWorker.postMessage({
        type: 'CodeChange',
        payload: initCode
    });
}
