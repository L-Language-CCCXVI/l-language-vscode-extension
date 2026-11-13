//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Load Libraries
//++++++++++++++++++++++++++++++++++++++++++++++++++//

import 'dotenv/config';
import * as fs from "fs";
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
    TransportKind,
    Trace
} from "vscode-languageclient/node";

//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Global Variables
//++++++++++++++++++++++++++++++++++++++++++++++++++//

let CLIENT: LanguageClient | undefined;
let CLIENT_START: Promise<void> | undefined;
let RESTARTING: Promise<void> | undefined;
let TRACE_OUTPUT: OutputChannel;

//++++++++++++++++++++++++++++++++++++++++++++++++++//
//>> Private Functions
//++++++++++++++++++++++++++++++++++++++++++++++++++//

/**
 * @brief Resolve the path to the L binary:
 *   1. User setting `l-language-vscode-extension.serverPath`
 *   2. Name on PATH ("L")
 */
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
    // Fall back to PATH
    const l_home = process.env.L_HOME;
    return l_home + "/L";
}

function getTraceLevel(): Trace {
    const value = workspace
        .getConfiguration("l-language-vscode-extension")
        .get<string>("trace.server", "off");

    switch (value) {
        case "messages":
            return Trace.Messages;
        case "verbose":
            return Trace.Verbose;
        default:
            return Trace.Off;
    }
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
    const serverOptions: ServerOptions = {
        command: serverPath,
        args: ["--lsp"],
        transport: TransportKind.stdio,
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "l" }],
        synchronize: {
            configurationSection: "l-language-vscode-extension",
        },
        traceOutputChannel: TRACE_OUTPUT
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
        window.showInformationMessage("L Language Server started.");
    } catch (error) {
        window.showErrorMessage(
            `L Language Server failed to start: ${error}`
        );
        if (CLIENT === client) {
            CLIENT = undefined;
            CLIENT_START = undefined;
        }
    }
}

async function restartLanguageServer(context: ExtensionContext): Promise<void> {
    // Prevent concurrent restart operations
    if (RESTARTING) {
        return RESTARTING;
    }
    RESTARTING = (async () => {
        const oldClient = CLIENT;
        if (oldClient) {
            // Wait for startup to finish before stopping
            try {
                await CLIENT_START;
            } catch {
                // Startup may already have failed
            }

            if (oldClient.isRunning()) {
                await oldClient.stop();
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
    context.subscriptions.push(TRACE_OUTPUT);
    TRACE_OUTPUT.appendLine("L Language Extension activated");

    // Configuration change
    context.subscriptions.push(
        workspace.onDidChangeConfiguration((event) => {
            if (
                event.affectsConfiguration(
                    "l-language-vscode-extension.trace.server"
                ) && CLIENT
            ) {
                CLIENT.setTrace(getTraceLevel());
            }
        })
    );

    // Commands
    context.subscriptions.push(
        commands.registerCommand(
            "l-language-vscode-extension.startServer",
            async () => {
                await startLanguageServer(context);
            }
        )
    );

    context.subscriptions.push(
        commands.registerCommand(
            "l-language-vscode-extension.restartServer",
            async () => {
                await restartLanguageServer(context);
            }
        )
    );

    // Automatic startup
    void startLanguageServer(context).catch((error) => {
        TRACE_OUTPUT.appendLine(`[Debug] Startup error: ${error}`);
    });

    // For Debug
    // context.subscriptions.push(
    //     workspace.onDidOpenTextDocument((document) => {
    //         TRACE_OUTPUT.appendLine(
    //             `Document opened: ${document.uri.toString()}, ` +
    //             `languageId: ${document.languageId}`
    //         );
    //     })
    // );
}

export function deactivate(): Thenable<void> | undefined {
    return CLIENT?.stop();
}
