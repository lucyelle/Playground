import * as monaco from 'monaco-editor/esm/vs/editor/editor.main.js';
import { ComponentContainer } from 'golden-layout';
import { inputCode } from '../app.js';

// this setup a monaco editor to input the code.
export class TextInput {
    static editors = [];

    rootElement: HTMLElement;
    resizeWithContainerAutomatically = true;

    constructor(public container: ComponentContainer) {
        this.rootElement = container.element;
        const div = document.createElement('div');
        div.classList.add('editor-container');
        this.rootElement.appendChild(div);
        const editor = monaco.editor.create(div, {
            value: inputCode,
            language: 'draco',
            theme: 'dynamic-theme', // this is a theme with create that we update dynamically when the user change the theme
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
            mouseWheelZoom: true
        });
        TextInput.editors.push(editor);
        container.on('resize', () => {
            editor.layout();
        });
    }
}
