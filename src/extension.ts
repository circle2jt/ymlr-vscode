// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import * as vscode from 'vscode';

const NodeBin = join(require.resolve('ymlr'), '..', '..', 'bin/cli.js')
const term = new Map<string, vscode.Terminal>()
const termNames = new Map<string, string>()
let debugLog: vscode.OutputChannel
let playStatusBar: vscode.StatusBarItem;
let lastScenario: string[] = []
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "ymlr-vscode" is now active!');

  debugLog = vscode.window.createOutputChannel('🚀 ymlr')
  debugLog.show(false)

  playStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
  playStatusBar.command = 'ymlr-vscode.run-from-sbar'
  playStatusBar.text = '🚀 ymlr'
  playStatusBar.tooltip = 'Run ymlr'
  context.subscriptions.push(playStatusBar)

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(vscode.commands.registerCommand('ymlr-vscode.run-from-sbar', async () => {
    if (lastScenario?.length) {
      executeCmd(lastScenario)
    }
  }))
  context.subscriptions.push(vscode.commands.registerCommand('ymlr-vscode.run', async (h: any) => {
    let scenarioPath = (h?.scheme === 'file' && h?.path) || vscode.window.activeTextEditor?.document.uri.fsPath
    if (!existsSync(scenarioPath)) {
      const textContent = vscode.window.activeTextEditor?.document.getText() as string
      if (textContent) {
        scenarioPath = join(tmpdir(), Math.random() + '.ymlr')
        writeFileSync(scenarioPath, textContent)
      }
    }
    const scenarioFile = [scenarioPath]
    executeCmd(scenarioFile)

  }))
}

// This method is called when your extension is deactivated
export function deactivate() { }

vscode.window.onDidCloseTerminal(e => {
  if (e.name.startsWith('🚀 ')) {
    const name = e.name.replace('🚀 ', '')
    term.delete(name)
    termNames.forEach((vl, key) => {
      if (vl === name) {
        termNames.delete(key)
      }
    })
  }
})

function getUniqueName(dir: string, fileName = '') {
  const name = basename(dir) + fileName
  if (term.has(name)) {
    const newName: string = getUniqueName(dirname(dir), `/${name}`)
    return newName
  }
  return name
}

async function executeCmd(scenarioFile: string[]) {
  try {
    const wsPath = vscode.workspace.workspaceFolders?.[0]?.uri.path
    const localYmlr = wsPath && join(wsPath, 'node_modules/ymlr/bin/cli.js')
    const nodeBin = (localYmlr && existsSync(localYmlr)) ? localYmlr : NodeBin
    let termObj: vscode.Terminal | undefined
    if (vscode.window.activeTerminal?.state.isInteractedWith) {
      termObj = vscode.window.activeTerminal
    } else {
      let terName = termNames.get(scenarioFile[0])
      if (!terName) {
        terName = getUniqueName(scenarioFile[0])
        termNames.set(scenarioFile[0], terName)
      }
      termObj = term.get(terName)
      if (!termObj) {
        termObj = vscode.window.createTerminal('🚀 ' + terName)
        term.set(terName, termObj)
      }
    }
    termObj.show(true)
    if (!/\.ya?ml$/i.test(scenarioFile[0]) && !scenarioFile[1]) {
      scenarioFile[1] = await getInput('Enter password to decrypt file', '')
    }
    const cmd = [nodeBin]
    cmd.push(scenarioFile[0], scenarioFile[1])
    updateLastScenario(scenarioFile)
    termObj.sendText(cmd.join(' '))
  } catch (err: any) {
    vscode.window.showErrorMessage('Error: ' + err.message + ' ❌❌❌')
    debugLog.appendLine('')
    debugLog.appendLine(err.message)
    debugLog.appendLine(err.stack)
    debugLog.show(true)
  }
}

function updateLastScenario(scenarioFile: string[]) {
  lastScenario = scenarioFile
  updatePlayStatusBar()
}

function updatePlayStatusBar() {
  if (lastScenario?.length) {
    playStatusBar.show()
    playStatusBar.text = `🚀 ${basename(lastScenario[0])}`
    playStatusBar.tooltip = `ymlr ${lastScenario[0]}`
  } else {
    playStatusBar.hide()
  }
}

async function getInput(label: string, value: string) {
  const inp = vscode.window.createInputBox()
  if (label) {
    inp.placeholder = label
  }
  inp.value = value
  inp.show()
  value = await new Promise<string>(r => {
    let isAccepted: boolean
    inp.onDidAccept(() => {
      if (!isAccepted) {
        inp.hide()
        r(inp.value || '')
      }
    })
    inp.onDidHide(() => {
      isAccepted = true
      inp.hide()
      r(inp.value || '')
    })
  })
  return value
}