import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as fs from 'fs';

export function renameCommit(hash: string, refresh: () => void) {
    const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!repoPath) {return;}

    exec(`git log -n 1 --pretty=%B ${hash}`, { cwd: repoPath }, async (err, stdout) => {
        if (err) {
            vscode.window.showErrorMessage("Impossible de lire le message du commit.");
            return;
        }

        const oldMessage = stdout.trim() || "";
        const commitFile = `${repoPath}/.git/COMMIT_EDITMSG`;
        fs.writeFileSync(commitFile, oldMessage, "utf8");

        const doc = await vscode.workspace.openTextDocument(commitFile);
        await vscode.window.showTextDocument(doc);

        const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
            if (savedDoc.fileName === commitFile) {
                const newMessage = savedDoc.getText().trim();
                if (!newMessage) {
                    vscode.window.showWarningMessage("Message de commit vide, annulé.");
                    saveListener.dispose();
                    return;
                }

                exec(`git rev-parse HEAD`, { cwd: repoPath }, (err2, stdout2) => {
                    if (err2) {
                        vscode.window.showErrorMessage("Impossible de vérifier le dernier commit.");
                        return;
                    }
                    const headHash = stdout2.trim();

                    if (headHash.startsWith(hash)) {
                        exec(`git commit --amend -F "${commitFile}"`, { cwd: repoPath }, (err3) => {
                            if (err3) {
                                vscode.window.showErrorMessage("Erreur lors du renommage du commit.");
                            } else {
                                vscode.window.showInformationMessage(`Commit renommé avec succès.`);
                                refresh();
                            }
                        });
                    } else {
                        vscode.window.showWarningMessage(
                            "Le renommage de commits anciens nécessite un rebase interactif (non encore implémenté)."
                        );
                    }
                });

                saveListener.dispose();
            }
        });
    });
}
