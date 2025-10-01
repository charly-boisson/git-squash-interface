import * as vscode from 'vscode';
import { CommitsWebviewProvider } from './providers/CommitsWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new CommitsWebviewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("gitSquashCommitsView", provider)
    );

    // Copier le hash
    context.subscriptions.push(
        vscode.commands.registerCommand("gitSquashCommits.copyHash", async (hash: string) => {
            await vscode.env.clipboard.writeText(hash);
            vscode.window.showInformationMessage(`Commit hash copié: ${hash}`);
        })
    );

    // Rafraîchir la vue
    context.subscriptions.push(
        vscode.commands.registerCommand("gitSquashCommits.refresh", async () => {
            provider.forceRefresh();
        })
    );
}
