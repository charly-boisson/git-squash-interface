import * as vscode from "vscode";
import { exec } from "child_process";
import { getCommits } from "../services/gitService";

export async function squashCommits(hashes: string[], refresh: () => void) {
    const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!repoPath) {return;}

    if (hashes.length < 2) {
        vscode.window.showWarningMessage("Sélectionne au moins deux commits consécutifs pour squash.");
        return;
    }

    // Récupérer tous les commits
    const allCommits = await getCommits(200);
    const selectedCommits = allCommits
        .filter(c => hashes.includes(c.hash))
        .sort(
            (a, b) =>
                allCommits.findIndex(ac => ac.hash === a.hash) -
                allCommits.findIndex(ac => ac.hash === b.hash)
        );

    // Vérifier consécutivité
    const indices = selectedCommits.map(c => allCommits.findIndex(ac => ac.hash === c.hash));
    for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) {
            vscode.window.showErrorMessage("Les commits sélectionnés ne sont pas consécutifs !");
            return;
        }
    }

    const newest = selectedCommits[0]; // le plus récent
    const oldest = selectedCommits[selectedCommits.length - 1]; // le plus ancien

    // Construire le message par défaut
    const defaultMessage = selectedCommits.slice().reverse().map(c => `- ${c.msg}`).join("\n");
    const newMessage = await vscode.window.showInputBox({
        title: "Message du commit squashé",
        value: defaultMessage,
        prompt: "Modifie le message du commit squashé",
        ignoreFocusOut: true
    });
    if (!newMessage) {return;}

    // Vérifier si HEAD fait partie de la sélection
    const headHash = await new Promise<string>((resolve, reject) => {
        exec("git rev-parse HEAD", { cwd: repoPath }, (err, stdout) => {
            if (err) {reject(err);}
            else {resolve(stdout.trim());}
        });
    });

    if (hashes.includes(headHash)) {
        // ============================================
        // CAS 1 : HEAD inclus → reset --soft + commit
        // ============================================
        exec(`git rev-parse ${oldest.hash}^`, { cwd: repoPath }, (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage("Impossible de trouver le parent du commit : " + (stderr || err.message));
                return;
            }
            const parent = stdout.trim();
            const cmd = `git reset --soft ${parent} && git commit -m "${newMessage.replace(/"/g, '\\"')}"`;

            exec(cmd, { cwd: repoPath, shell: "/bin/bash" }, (err2, stdout2, stderr2) => {
                if (err2) {
                    vscode.window.showErrorMessage("Erreur lors du squash (HEAD inclus): " + (stderr2 || err2.message));
                    console.error("❌ Squash error:", err2);
                    console.error("stderr:", stderr2);
                    console.error("stdout:", stdout2);
                } else {
                    vscode.window.showInformationMessage(
                        `Squash de ${hashes.length} commits effectué avec succès ⚠️ Push --force nécessaire.`
                    );
                    console.log("✅ Squash réussi:", stdout2);
                    refresh();
                }
            });
        });
    } else {
        // ======================================================
        // CAS 2 : HEAD NON inclus → rebase interactif automatisé
        // ======================================================
        exec(`git rev-parse ${oldest.hash}^`, { cwd: repoPath }, (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage("Impossible de trouver le parent du commit : " + (stderr || err.message));
                return;
            }
            const parent = stdout.trim();

            // ⚡ Important : oldest = pick, les autres = squash
            const pickHash = oldest.hash.substring(0, 7);
            const squashHashes = selectedCommits
                .filter(c => c.hash !== oldest.hash)
                .map(c => c.hash.substring(0, 7));

            const sedScript = [`s/^pick ${pickHash}/pick ${pickHash}/`];
            squashHashes.forEach(h => sedScript.push(`s/^pick ${h}/squash ${h}/`));

            const squashMessage = newMessage.replace(/"/g, '\\"');

            const rebaseCmd = `git rebase -i ${parent}`;
            const fullCmd = `
                GIT_SEQUENCE_EDITOR="sed -i -e '${sedScript.join("; ")}'" \
                GIT_EDITOR=true \
                ${rebaseCmd} && git commit --amend -m "${squashMessage}"
            `;

            exec(fullCmd, { cwd: repoPath, shell: "/bin/bash" }, (err2, stdout2, stderr2) => {
                if (err2) {
                    vscode.window.showErrorMessage("Erreur lors du squash via rebase interactif : " + (stderr2 || err2.message));
                    console.error("❌ Rebase squash error:", err2);
                    console.error("stderr:", stderr2);
                    console.error("stdout:", stdout2);
                } else {
                    vscode.window.showInformationMessage(
                        `Squash de ${hashes.length} commits effectué via rebase ⚠️ Push --force nécessaire.`
                    );
                    console.log("✅ Rebase squash réussi:", stdout2);
                    refresh();
                }
            });
        });

    }
}
