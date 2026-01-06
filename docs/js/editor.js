/**
 * p5.js Course - Code Editor Module
 * Provides an advanced code editor with live preview, console output,
 * syntax highlighting, line numbers, and various utility features.
 */

class P5CodeEditor {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with id "${containerId}" not found`);
            return;
        }

        // Default options
        this.options = {
            theme: 'tomorrow-night-eighties',
            fontSize: 14,
            lineNumbers: true,
            autoRun: true,
            showConsole: true,
            previewWidth: 400,
            previewHeight: 400,
            ...options
        };

        this.editor = null;
        this.originalCode = '';
        this.consoleMessages = [];
        
        this.init();
    }

    init() {
        this.createStructure();
        this.initCodeMirror();
        this.bindEvents();
        
        if (this.options.autoRun && this.options.initialCode) {
            this.setCode(this.options.initialCode);
            this.runCode();
        }
    }

    createStructure() {
        this.container.innerHTML = `
            <div class="code-editor-container">
                <div class="editor-header">
                    <div class="editor-title">
                        <span class="editor-icon">📝</span>
                        <span class="editor-filename">${this.options.filename || 'sketch.js'}</span>
                    </div>
                    <div class="editor-actions">
                        <button class="btn btn-small btn-success run-btn" title="Kodu Çalıştır (Ctrl+Enter)">
                            ▶ Çalıştır
                        </button>
                        <button class="btn btn-small btn-secondary reset-btn" title="Orijinal Koda Dön">
                            ↺ Sıfırla
                        </button>
                        <button class="btn btn-small btn-secondary copy-btn" title="Kodu Kopyala">
                            📋 Kopyala
                        </button>
                    </div>
                </div>
                
                <div class="examples-tabs" style="display: none;"></div>
                
                <div class="editor-body">
                    <div class="editor-panel">
                        <textarea class="code-textarea"></textarea>
                    </div>
                    <div class="preview-panel">
                        <span class="preview-label">Önizleme (${this.options.previewWidth}×${this.options.previewHeight})</span>
                        <iframe class="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
                    </div>
                </div>
                
                ${this.options.showConsole ? `
                <div class="console-output preview-console">
                    <div class="console-header">
                        <span>📋 KONSOL</span>
                        <button class="btn btn-small clear-console-btn">Temizle</button>
                    </div>
                    <div class="console-messages">
                        <div class="console-placeholder">Konsol çıktısı burada görünecek...</div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        // Cache DOM references
        this.textarea = this.container.querySelector('.code-textarea');
        this.previewFrame = this.container.querySelector('.preview-frame');
        this.runBtn = this.container.querySelector('.run-btn');
        this.resetBtn = this.container.querySelector('.reset-btn');
        this.copyBtn = this.container.querySelector('.copy-btn');
        this.examplesTabs = this.container.querySelector('.examples-tabs');
        this.consoleMessagesEl = this.container.querySelector('.console-messages');
        this.clearConsoleBtn = this.container.querySelector('.clear-console-btn');
    }

    initCodeMirror() {
        this.editor = CodeMirror.fromTextArea(this.textarea, {
            mode: 'javascript',
            theme: this.options.theme,
            lineNumbers: this.options.lineNumbers,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 2,
            tabSize: 2,
            indentWithTabs: false,
            lineWrapping: false,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            extraKeys: {
                'Ctrl-Enter': () => this.runCode(),
                'Cmd-Enter': () => this.runCode(),
                'Ctrl-S': (cm) => { this.runCode(); return false; },
                'Cmd-S': (cm) => { this.runCode(); return false; }
            }
        });

        this.editor.setSize('100%', '100%');
    }

    bindEvents() {
        this.runBtn.addEventListener('click', () => this.runCode());
        this.resetBtn.addEventListener('click', () => this.resetCode());
        this.copyBtn.addEventListener('click', () => this.copyCode());
        
        if (this.clearConsoleBtn) {
            this.clearConsoleBtn.addEventListener('click', () => this.clearConsole());
        }

        // Listen for console messages from iframe
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'console') {
                this.addConsoleMessage(event.data.method, event.data.args);
            }
        });
    }

    setCode(code) {
        this.originalCode = code;
        this.editor.setValue(code);
    }

    getCode() {
        return this.editor.getValue();
    }

    runCode() {
        const code = this.getCode();
        this.clearConsole();
        
        const html = this.generatePreviewHTML(code);
        const blob = new Blob([html], { type: 'text/html' });
        this.previewFrame.src = URL.createObjectURL(blob);
    }

    generatePreviewHTML(code) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: #000; 
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        canvas { 
            display: block;
        }
    </style>
</head>
<body>
    <script>
        // Override console methods to send messages to parent
        (function() {
            const originalConsole = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
            };
            
            function sendToParent(method, args) {
                try {
                    window.parent.postMessage({
                        type: 'console',
                        method: method,
                        args: Array.from(args).map(arg => {
                            if (typeof arg === 'object') {
                                try {
                                    return JSON.stringify(arg);
                                } catch(e) {
                                    return String(arg);
                                }
                            }
                            return String(arg);
                        })
                    }, '*');
                } catch(e) {}
            }
            
            console.log = function() {
                sendToParent('log', arguments);
                originalConsole.log.apply(console, arguments);
            };
            
            console.error = function() {
                sendToParent('error', arguments);
                originalConsole.error.apply(console, arguments);
            };
            
            console.warn = function() {
                sendToParent('warn', arguments);
                originalConsole.warn.apply(console, arguments);
            };
            
            console.info = function() {
                sendToParent('info', arguments);
                originalConsole.info.apply(console, arguments);
            };
            
            window.onerror = function(message, source, lineno, colno, error) {
                sendToParent('error', ['Error: ' + message + ' (line ' + lineno + ')']);
                return false;
            };
        })();
    </script>
    <script>
        try {
            ${code}
        } catch(err) {
            console.error('Runtime Error: ' + err.message);
            function setup() {
                createCanvas(400, 400);
                background(40);
                fill(255, 100, 100);
                textAlign(CENTER, CENTER);
                textSize(16);
                text('Error: ' + err.message, width/2, height/2);
                noLoop();
            }
        }
    </script>
</body>
</html>`;
    }

    resetCode() {
        if (this.originalCode) {
            this.editor.setValue(this.originalCode);
            this.runCode();
        }
    }

    copyCode() {
        const code = this.getCode();
        navigator.clipboard.writeText(code).then(() => {
            const originalText = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '✓ Copied!';
            setTimeout(() => {
                this.copyBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    addConsoleMessage(method, args) {
        if (!this.consoleMessagesEl) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `console-message ${method}`;
        messageEl.textContent = args.join(' ');
        this.consoleMessagesEl.appendChild(messageEl);
        this.consoleMessagesEl.scrollTop = this.consoleMessagesEl.scrollHeight;
        
        this.consoleMessages.push({ method, args });
    }

    clearConsole() {
        if (this.consoleMessagesEl) {
            this.consoleMessagesEl.innerHTML = '';
        }
        this.consoleMessages = [];
    }

    setExamples(examples) {
        if (!examples || examples.length === 0) {
            this.examplesTabs.style.display = 'none';
            return;
        }

        this.examplesTabs.style.display = 'flex';
        this.examplesTabs.innerHTML = '';
        this.examples = examples;

        examples.forEach((example, index) => {
            const tab = document.createElement('button');
            tab.className = 'example-tab' + (index === 0 ? ' active' : '');
            tab.textContent = example.name;
            tab.addEventListener('click', () => this.loadExample(index));
            this.examplesTabs.appendChild(tab);
        });

        // Load first example
        if (examples.length > 0) {
            this.loadExample(0);
        }
    }

    loadExample(index) {
        const example = this.examples[index];
        if (!example) return;

        // Update active tab
        this.examplesTabs.querySelectorAll('.example-tab').forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });

        this.setCode(example.code);
        this.runCode();
    }

    destroy() {
        if (this.editor) {
            this.editor.toTextArea();
        }
        this.container.innerHTML = '';
    }
}

// Simple editor for inline code examples (without full features)
class SimpleP5Preview {
    constructor(containerId, code, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.code = code;
        this.options = {
            width: 400,
            height: 400,
            autoRun: true,
            ...options
        };

        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="simple-preview" style="
                background: #000;
                border-radius: 8px;
                overflow: hidden;
                display: inline-block;
            ">
                <iframe 
                    class="preview-frame" 
                    style="
                        width: ${this.options.width}px;
                        height: ${this.options.height}px;
                        border: none;
                        display: block;
                    "
                    sandbox="allow-scripts allow-same-origin"
                ></iframe>
            </div>
        `;

        this.frame = this.container.querySelector('.preview-frame');
        
        if (this.options.autoRun) {
            this.run();
        }
    }

    run() {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
    <style>
        * { margin: 0; padding: 0; }
        body { background: #000; overflow: hidden; }
    </style>
</head>
<body>
    <script>
        try {
            ${this.code}
        } catch(e) {
            function setup() {
                createCanvas(${this.options.width}, ${this.options.height});
                background(50);
                fill(255, 100, 100);
                textAlign(CENTER);
                text('Error: ' + e.message, width/2, height/2);
                noLoop();
            }
        }
    </script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        this.frame.src = URL.createObjectURL(blob);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { P5CodeEditor, SimpleP5Preview };
}
