import * as vscode from 'vscode';

export async function copyHash(hash: string) {
    await vscode.env.clipboard.writeText(hash);
    vscode.window.showInformationMessage(`Commit hash copié: ${hash}`);
}
