import * as monaco from 'monaco-editor/esm/vs/editor/editor.main.js';
import { ComponentContainer } from 'golden-layout';
import { getDownloadViewElement } from '../cache.js';
import { subscribeOutputChange } from '../dotnet.js';

// this setup a readonly monaco editor to view code output (IR/IL)

export class TextDisplay {
    static editors = {};

    rootElement: HTMLElement;
    resizeWithContainerAutomatically = true;

    constructor(public container: ComponentContainer) {
        this.rootElement = container.element;
        this.rootElement.appendChild(getDownloadViewElement());
        const div = document.createElement('div');
        div.classList.add('editor-container');
        div.classList.add('output-viewer');
        this.rootElement.appendChild(div);
        const editor = monaco.editor.create(div, {
            theme: 'dynamic-theme', // this is a theme with create that we update dynamically when the user change the theme
            language: container.title.toLowerCase(), // we use the title of the container to set the language
            readOnly: true,
            scrollbar: {
                vertical: 'visible'
            },
            scrollBeyondLastLine: false,
            minimap: {
                enabled: false
            },
            renderLineHighlight: 'none',
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            mouseWheelZoom: true,
            occurrencesHighlight: false,
        });
        TextDisplay.editors[container.title] = editor;
        container.on('resize', () => {
            editor.layout();
        });
        subscribeOutputChange((arg) => {
            // subscribeOutputChange fire when there is a new 'output',
            // the title of our container correspond to the type of output it display.
            if (arg.outputType == container.title) {
                editor.setValue(arg.value);
            }
        });
    }
}
