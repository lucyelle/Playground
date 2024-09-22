import { deflateRaw, inflateRaw } from 'pako';
import { GoldenLayout, LayoutConfig } from 'golden-layout';
import { fromBase64, fromBase64ToBase64URL, fromBase64URLToBase64, toBase64 } from './helpers.js';
import { initDotnetWorkers, setCode, subscribeOutputChange } from './dotnet.js';
import { TextDisplay } from './LayoutComponents/TextDisplay.js';
import { StdOut } from './LayoutComponents/StdOut.js';
import { TextInput } from './LayoutComponents/TextInput.js';
import { loadThemes } from './loadThemes.js';
import { Settings } from './LayoutComponents/Settings.js';

// this file is the entry point.

function updateHash(code: string) {
    // setting the URL Hash with the state of the editor.
    // Doing this before invoking DotNet will allow sharing hard crash.
    const encoded = new TextEncoder().encode(code);
    const compressed = deflateRaw(encoded);
    const buffer = new Uint8Array(compressed.length + 1);
    buffer[0] = 2; // version, for future use.
    buffer.set(compressed, 1);
    history.replaceState(undefined, undefined, '#' + fromBase64ToBase64URL(toBase64(buffer)));
}

// that's because monaco doesn't help you when you have a bundler, you have to do it by hand.
// https://github.com/microsoft/monaco-editor/blob/main/samples/browser-esm-esbuild/index.js

self.MonacoEnvironment = {
    // Web Workers need to start a new script, by url.
    // This is the path where the script of the webworker is served.
    getWorkerUrl: function () {
        return './editor.worker.js';
    }
};

const hash = window.location.hash.slice(1); // retrieve hash, which contain the stored code.
export let inputCode = `import System.Console;

func main() {
    WriteLine("Hello, World!");
}
`;

if (hash != null && hash.trim().length > 0) {
    // We store data in the hash of the url, so we need to decode it on load.
    try {
        const b64 = fromBase64URLToBase64(hash);// our hash is encoded in base64 url: https://en.wikipedia.org/wiki/Base64#URL_applications
        let buffer = fromBase64(b64);
        const version = buffer[0];
        buffer = buffer.subarray(1); // Version byte, for future usage.
        const uncompressed = inflateRaw(buffer);
        let str = new TextDecoder().decode(uncompressed);
        if (version == 1) {
            const firstNewLine = str.indexOf('\n');
            str.slice(0, firstNewLine);
            str = str.slice(firstNewLine + 1);
        }
        inputCode = str;
    } catch (e) {
        inputCode = `Error while decoding the URL hash. ${e}`;
    }
}



const layoutElement = document.querySelector('#layoutContainer') as HTMLElement;

const config: LayoutConfig = {
    root: {
        type: 'row',
        content: [
            {
                title: 'Input',
                type: 'component',
                componentType: 'TextInput',
                width: 50
            },
            {
                type: 'stack',
                content: [
                    {
                        title: 'IR',
                        type: 'component',
                        componentType: 'TextDisplay'
                    },
                    {
                        title: 'IL',
                        type: 'component',
                        componentType: 'TextDisplay'
                    },
                    {
                        title: 'Console',
                        type: 'component',
                        componentType: 'StdOut'
                    },
                    {
                        title: 'Settings',
                        type: 'component',
                        componentType: 'Settings'
                    }
                ]
            }
        ]
    }
};


const goldenLayout = new GoldenLayout(layoutElement);
goldenLayout.registerComponentConstructor('TextInput', TextInput);
goldenLayout.registerComponentConstructor('StdOut', StdOut);
goldenLayout.registerComponentConstructor('TextDisplay', TextDisplay);
goldenLayout.registerComponentConstructor('Settings', Settings);

goldenLayout.loadLayout(config);
const inputEditor = TextInput.editors[0];
inputEditor.getModel().onDidChangeContent(() => { // when the input editor content change...
    const code = inputEditor.getModel().getValue();
    setCode(code); // this sends the code to the dotnet worker.
    updateHash(code); // and update the hash of the URL.
});

subscribeOutputChange((arg) => { // and this piece of code that have nothing to do here, update the xterm terminal with what the dotnet worker sent.
    if (arg.outputType == 'stdout') {
        if (arg.clear) {
            StdOut.terminals[0].reset();
        }
        StdOut.terminals[0].write(arg.value);
    }
});

loadThemes(); // this does the black magic in order to have vscode theme on monaco.
initDotnetWorkers(inputCode);
