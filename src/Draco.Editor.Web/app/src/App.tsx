import React from 'react';
import Editor from '@monaco-editor/react';

function App() {
  const input = `import System.Console;

func main() {
    WriteLine("Hello, World!");
}
`;
  return (
    <div>
      <Editor height={600} value={input}/>
    </div>
  );
}

export default App;
