// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const fs = require('fs');
const path = require('path');
const request = require('request');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "webagi-code" is now active!');

	let TIMEOUT = 1500;

	let currentPath: string | undefined;
	let interval: NodeJS.Timeout | undefined;


	// on document change
	vscode.workspace.onDidChangeTextDocument((event) => {
		if(!currentPath) return;
		if(event.document.fileName !== currentPath) return;

		const apiKey = vscode.workspace.getConfiguration().get("webagi-code.apiKey");
		if (!apiKey) {
			vscode.window.showErrorMessage("Please enter your OpenAI API key in the settings");
			return;
		}

		if(interval) clearTimeout(interval);
		interval = setTimeout(() => {
			interval = undefined;
			execute(currentPath || "", apiKey.toString());
		}, TIMEOUT);

		// execute(currentPath, apiKey.toString());
	});

	const execute = (path: string, apiKey: string) => {
		currentPath = path;

		const sourcePath = path.replace(".pseudo", ".js");

		const psduoCode = fs.readFileSync(path, 'utf8');	

		console.log("Processing " + path.split("\\").pop());

		const prompt = `
# Pseudocode to Code 
Convert the pseudocode to code, try to be as accurate as possible.

## Examples

### Example

#### Input
\`\`\`
using nodejs

time = milliseconds
\`\`\`

#### Output
\`\`\`nodejs
const time = Date.now();
\`\`\`

### Example

#### Input
\`\`\`
using nodejs

print hello world

loop 10 times
	print x time loop'd
\`\`\`

#### Output
\`\`\`nodejs
console.log('Hello World');

for (let i = 0; i < 10; i++) {
  console.log(\`\${i} time loop'd\`);
}
\`\`\`

### Example

#### Input
\`\`\`
${psduoCode}
\`\`\`

#### Output
\`\`\`javascript\n`;
		request({
			url: 'https://api.openai.com/v1/completions',
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + apiKey,
				'Content-Type': 'application/json'
			},
			json: {
				model: "code-davinci-002",
				prompt: prompt,
				max_tokens: 200,
				n: 1,
				stop: '\n```',
				temperature: 0.1,
				top_p: 1,
				frequency_penalty: 0.10,
				presence_penalty: 0.10,
				stream: false,
				logprobs: null
			}
		}, (error: any, response: any, body: any) => {
			if(error) console.error(error);
			if(!response || response.statusCode !== 200) {
				console.log(response.statusCode);
				console.log(body);
			}
			console.log(body.choices[0].text);
			// leftDoc.setText(body.choices[0].texwt);

			// set the text of the letDoc
			fs.writeFileSync(sourcePath, body.choices[0].text);
		});
	}

	let newDisposable = vscode.commands.registerCommand('webagi-code.new', () => {

		let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

		// check if there is an active js document open
		if (editor.document.languageId !== "javascript") {
			vscode.window.showErrorMessage("Please open a javascript file");
			return;
		}

		const doc = editor.document;

		let path = doc.fileName;
		// change path to .pseudo
		path = path.replace(".js", ".pseudo");
		
		if(!fs.existsSync(path)) {
			// create file
			fs.writeFileSync(path, "// pseudocode for " + doc.fileName.split("\\").pop());
		}

		// open path file
		vscode.workspace.openTextDocument(path).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
		});

	});
	context.subscriptions.push(newDisposable);


	let executeDisposable = vscode.commands.registerCommand('webagi-code.execute', () => {
		
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const apiKey = vscode.workspace.getConfiguration().get("webagi-code.apiKey");
		if (!apiKey) {
			vscode.window.showErrorMessage("Please enter your OpenAI API key in the settings");
			return;
		}
		console.log("API Key: " + apiKey);


		// get all open documents
		let docs = vscode.workspace.textDocuments;
		docs = docs.filter(doc => {
			return !doc.isClosed && doc.fileName.includes(".pseudo");
		});

		if(docs.length === 0) {
			vscode.window.showErrorMessage("Please open a pseudocode file");
			return;
		}

		const doc = docs[0];

		const path = doc.fileName;

		execute(path, apiKey.toString());
	});
		
	context.subscriptions.push(executeDisposable);


	let settingsDisposable = vscode.commands.registerCommand('webagi-code.settings', () => {

		// ask the user for their openAI API key
		vscode.window.showInputBox({
			placeHolder: "Enter your OpenAI API key",
			ignoreFocusOut: true,
			validateInput: (value: string) => {
				if (value.length === 0) {
					return "Please enter your API key";
				}
				return null;
			}
		}).then((value) => {
			if (value) {
				console.log("Saved API key: " + value);

				// save the API key to the user's settings
				vscode.workspace.getConfiguration().update("webagi-code.apiKey", value, true);

				// send message
				vscode.window.showInformationMessage("Saved OpenAI API Key " + value);

			}
		});
		
	});
	context.subscriptions.push(settingsDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
