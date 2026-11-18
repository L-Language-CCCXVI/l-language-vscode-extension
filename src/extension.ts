//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Load Libraries
//++++++++++++++++++++++++++++++++++++++++++++++++++//

import 'dotenv/config';
import * as fs from "fs";
import * as cp from "child_process";
import {
    commands,
    ExtensionContext,
    OutputChannel,
    window,
    workspace
} from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Trace
} from "vscode-languageclient/node";

//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Global Variables
//++++++++++++++++++++++++++++++++++++++++++++++++++//

let CLIENT: LanguageClient | undefined;
let CLIENT_START: Promise<void> | undefined;
let RESTARTING: Promise<void> | undefined;
let TRACE_OUTPUT: OutputChannel;
let SERVER_LOG: OutputChannel;

//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Private Functions
//++++++++++++++++++++++++++++++++++++++++++++++++++//

function resolveServerPath(context: ExtensionContext): string | undefined {
    const config = workspace.getConfiguration("l-language-vscode-extension");
    const userPath = config.get<string>("serverPath", "").trim();
    if (userPath) {
        if (fs.existsSync(userPath)) {
            return userPath;
        }
        window.showWarningMessage(`L Language: configured serverPath "${userPath}" does not exist.`);
        return undefined;
    }
    const l_home = process.env.L_HOME;
    return l_home + "/L";
}

function getTraceLevel(): Trace {
    const value = workspace
        .getConfiguration("l-language-vscode-extension")
        .get<string>("trace.server", "off");

    switch (value) {
        case "messages": return Trace.Messages;
        case "verbose":  return Trace.Verbose;
        default:         return Trace.Off;
    }
}

function timestamp(): string {
    return new Date().toISOString();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Interfaces
//++++++++++++++++++++++++++++++++++++++++++++++++++//

async function startLanguageServer(context: ExtensionContext): Promise<void> {
    if (CLIENT?.isRunning()) {
        return;
    }

    const serverPath = resolveServerPath(context);
    if (!serverPath) {
        window.showErrorMessage(
            'L Language: Set "l-language-vscode-extension.serverPath" ' +
            "or add L to PATH."
        );
        return;
    }

    // By having ServerOptions a functional expression we can start the process ourselves and
    // set stderr to pipe.
    const serverOptions: ServerOptions = () => new Promise((resolve, reject) => {
        const proc = cp.spawn(serverPath, ["--lsp"], {
            // Pipe stdin, stdout, stderr
            stdio: ["pipe", "pipe", "pipe"],
        });

        proc.on("error", reject);

        // Transfer stderr to OutputChannel
        let leftover = "";
        proc.stderr.setEncoding("utf8");
        proc.stderr.on("data", (chunk: string) => {
            const lines = (leftover + chunk).split(/\r?\n/);
            leftover = lines.pop() ?? "";
            for (const line of lines) {
                // Log level is appended in the server side
                SERVER_LOG.appendLine(`[${timestamp()}] ${line}`);
            }
        });
        proc.stderr.on("close", () => {
            if (leftover) {
                // Log level is appended in the server side
                SERVER_LOG.appendLine(`[${timestamp()}] ${leftover}`);
            }
            SERVER_LOG.appendLine(`[${timestamp()}] [INFO] stderr closed`);
        });

        // Resolve in the form that vscode-languageclient requires
        resolve({
            process: proc,
            reader: proc.stdout,
            writer: proc.stdin,
            detached: false,
        });
    });

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "l" }],
        synchronize: {
            configurationSection: "l-language-vscode-extension",
        },
        traceOutputChannel: TRACE_OUTPUT,
    };

    const client = new LanguageClient(
        "l",
        "L Language",
        serverOptions,
        clientOptions
    );

    CLIENT = client;
    CLIENT_START = client.start();

    try {
        await CLIENT_START;
        await CLIENT.setTrace(getTraceLevel());
        SERVER_LOG.appendLine(`[${timestamp()}] [INFO] L Language Server started.`);
        window.showInformationMessage("L Language Server started.");
    } catch (error) {
        SERVER_LOG.appendLine(`[${timestamp()}] [ERROR] Server failed to start: ${error}`);
        window.showErrorMessage(`L Language Server failed to start: ${error}`);
        if (CLIENT === client) {
            CLIENT = undefined;
            CLIENT_START = undefined;
        }
    }
}

async function restartLanguageServer(context: ExtensionContext): Promise<void> {
    if (RESTARTING) {
        return RESTARTING;
    }

    RESTARTING = (async () => {
        const oldClient = CLIENT;
        if (oldClient) {
            try { await CLIENT_START; } catch { /* startup may have failed */ }

            if (oldClient.isRunning()) {
                SERVER_LOG.appendLine(`[${timestamp()}] [INFO] Stopping server...`);
                await oldClient.stop();
                SERVER_LOG.appendLine(`[${timestamp()}] [INFO] Server stopped.`);
            }

            if (CLIENT === oldClient) {
                CLIENT = undefined;
                CLIENT_START = undefined;
            }
        }
        await startLanguageServer(context);
    })();

    try {
        await RESTARTING;
    } finally {
        RESTARTING = undefined;
    }
}

export function activate(context: ExtensionContext): void {
    TRACE_OUTPUT = window.createOutputChannel("L Language LSP Trace");
    SERVER_LOG   = window.createOutputChannel("L Language Server Log");
    context.subscriptions.push(TRACE_OUTPUT, SERVER_LOG);

    TRACE_OUTPUT.appendLine("L Language Extension activated");
    SERVER_LOG.appendLine(`[${timestamp()}] [INFO] Extension activated.`);

    context.subscriptions.push(
        workspace.onDidChangeConfiguration((event) => {
            if (
                event.affectsConfiguration("l-language-vscode-extension.trace.server")
                && CLIENT
            ) {
                CLIENT.setTrace(getTraceLevel());
            }
        })
    );

    context.subscriptions.push(
        commands.registerCommand(
            "l-language-vscode-extension.startServer",
            async () => { await startLanguageServer(context); }
        )
    );

    context.subscriptions.push(
        commands.registerCommand(
            "l-language-vscode-extension.restartServer",
            async () => { await restartLanguageServer(context); }
        )
    );

    void startLanguageServer(context).catch((error) => {
        TRACE_OUTPUT.appendLine(`[Debug] Startup error: ${error}`);
        SERVER_LOG.appendLine(`[${timestamp()}] [ERROR] Startup error: ${error}`);
    });
}

export function deactivate(): Thenable<void> | undefined {
    return CLIENT?.stop();
}